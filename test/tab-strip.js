// A model of how Chrome moves tabs, transcribed from chromium/src:
//   chrome/browser/extensions/api/tabs/tabs_api.cc              TabsMoveFunction::MoveTab
//   chrome/browser/extensions/api/tab_groups/tab_groups_api.cc  TabGroupsMoveFunction::MoveGroup
//   chrome/browser/ui/tabs/tab_strip_model.cc                    MoveWebContentsAt, GetGroupToAssign,
//                                                                MaybeRemoveSplitsForMove, MoveGroupTo
// Side effects a sort must never cause (a tab joining or leaving a group, a split view being
// dissolved) are recorded in `events`.

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class TabStrip {
    constructor(tabs) {
        this.tabs = tabs.map(({ id, pinned = false, groupId = -1, splitViewId = -1 }) => ({ id, pinned, groupId, splitViewId }));
        this.events = [];
    }

    get ids() {
        return this.tabs.map(tab => tab.id);
    }

    apply(moves) {
        for (const move of moves) {
            if (move.groupId !== undefined) this.moveGroup(move.groupId, move.index);
            else this.moveTabs(move.tabIds, move.index);
        }
    }

    // chrome.tabs.move(tabIds, { index })
    moveTabs(tabIds, index) {
        let newIndex = index;
        for (const id of tabIds) {
            const from = this.#indexOf(id);
            if (newIndex >= this.tabs.length || newIndex < 0) newIndex = this.tabs.length - 1;
            if (newIndex !== from) newIndex = this.#moveWebContentsAt(from, newIndex);
            newIndex += 1; // "Insert the tabs one after another."
        }
    }

    // chrome.tabGroups.move(groupId, { index })
    moveGroup(groupId, index) {
        const indices = this.tabs.flatMap((tab, i) => (tab.groupId === groupId ? [i] : []));
        if (!indices.length) throw new Error(`No group with id: ${groupId}.`);
        const start = indices[0];
        const length = indices.length;

        // IndexSupportsGroupMove(new_index_before_group_is_removed)
        const check = index > start ? index + length : index;
        if (check >= 0 && check < this.tabs.length) {
            const target = this.tabs[check];
            if (target.pinned) throw new Error('Cannot move the group to an index that is in the middle of pinned tabs.');
            if (target.groupId !== -1 && check > 0 && this.tabs[check - 1].groupId === target.groupId) {
                throw new Error('Cannot move the group to an index that is in the middle of another group.');
            }
        }
        const sizeAfterRemoval = this.tabs.length - length;
        if (index >= sizeAfterRemoval || index < 0) index = sizeAfterRemoval;
        if (index === start) return;

        const to = clamp(index, this.#firstUnpinned(), this.tabs.length - length);
        this.#removeSplitAround(start < to ? to - 1 + length : to - 1); // MoveBreaksSplitContiguity
        this.tabs.splice(to, 0, ...this.tabs.splice(start, length));
    }

    #moveWebContentsAt(from, requested) {
        const tab = this.tabs[from];
        const firstUnpinned = this.#firstUnpinned();
        const to = tab.pinned ? clamp(requested, 0, firstUnpinned - 1) : clamp(requested, firstUnpinned, this.tabs.length - 1);
        if (to === from) return to;

        // GetGroupToAssign
        const [left, right] = to > from ? [this.#group(to), this.#group(to + 1)] : [this.#group(to - 1), this.#group(to)];
        let groupId = tab.groupId;
        if (tab.groupId !== left && tab.groupId !== right) {
            if (left === right && left !== -1) groupId = left;
            else if (tab.groupId !== -1 && this.tabs.filter(t => t.groupId === tab.groupId).length > 1) groupId = -1;
        }

        // MaybeRemoveSplitsForMove
        const withinSplit = tab.splitViewId !== -1 && this.tabs[to].splitViewId === tab.splitViewId && groupId === tab.groupId;
        if (!withinSplit) {
            if (tab.splitViewId !== -1) this.#removeSplit(tab.splitViewId);
            this.#removeSplitAround(from < to ? to : to - 1);
        }

        if (groupId !== tab.groupId) this.events.push(`tab ${tab.id} moved from group ${tab.groupId} to ${groupId}`);
        this.tabs.splice(from, 1);
        this.tabs.splice(to, 0, { ...tab, groupId });
        return to;
    }

    // Dissolves the split view that a tab inserted between `previous` and `previous + 1` would break.
    #removeSplitAround(previous) {
        const next = previous + 1;
        if (previous < 0 || next >= this.tabs.length) return;
        const split = this.tabs[previous].splitViewId;
        if (split !== -1 && split === this.tabs[next].splitViewId) this.#removeSplit(split);
    }

    #removeSplit(splitViewId) {
        this.events.push(`split view ${splitViewId} dissolved`);
        for (const tab of this.tabs) if (tab.splitViewId === splitViewId) tab.splitViewId = -1;
    }

    #indexOf(id) {
        const index = this.tabs.findIndex(tab => tab.id === id);
        if (index === -1) throw new Error(`No tab with id: ${id}.`);
        return index;
    }

    #group(index) {
        return this.tabs[index]?.groupId ?? -1;
    }

    #firstUnpinned() {
        const index = this.tabs.findIndex(tab => !tab.pinned);
        return index === -1 ? this.tabs.length : index;
    }
}
