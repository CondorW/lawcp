import type { Subtask } from '$lib/types';

export function cloneSubtasks(nodes: Subtask[]): Subtask[] {
	return nodes.map((node) => ({
		...node,
		next: [...node.next],
		subtasks: cloneSubtasks(node.subtasks)
	}));
}

export function sortSubtasksDeep(nodes: Subtask[]): Subtask[] {
	return nodes
		.map((node) => ({ ...node, subtasks: sortSubtasksDeep(node.subtasks) }))
		.sort((left, right) => {
			if (left.done !== right.done) return Number(left.done) - Number(right.done);
			if (left.reviewState === 'REQUESTED' || right.reviewState === 'REQUESTED') {
				return Number(right.reviewState === 'REQUESTED') - Number(left.reviewState === 'REQUESTED');
			}
			if (left.reviewState === 'REVISION' || right.reviewState === 'REVISION') {
				return Number(right.reviewState === 'REVISION') - Number(left.reviewState === 'REVISION');
			}
			return 0;
		});
}

export function updateSubtask(
	nodes: Subtask[],
	targetId: string,
	update: (subtask: Subtask) => Subtask
): Subtask[] {
	return nodes.map((node) => {
		if (node.id === targetId) return update(node);
		return node.subtasks.length > 0
			? { ...node, subtasks: updateSubtask(node.subtasks, targetId, update) }
			: node;
	});
}

export function addChildSubtask(nodes: Subtask[], parentId: string, child: Subtask): Subtask[] {
	return nodes.map((node) => {
		if (node.id === parentId) return { ...node, subtasks: [...node.subtasks, child] };
		return node.subtasks.length > 0
			? { ...node, subtasks: addChildSubtask(node.subtasks, parentId, child) }
			: node;
	});
}

export function removeSubtask(nodes: Subtask[], targetId: string): Subtask[] {
	return nodes
		.filter((node) => node.id !== targetId)
		.map((node) => ({
			...node,
			next: node.next.filter((id) => id !== targetId),
			subtasks: removeSubtask(node.subtasks, targetId)
		}));
}

export function findSubtask(nodes: Subtask[], targetId: string): Subtask | null {
	for (const node of nodes) {
		if (node.id === targetId) return node;
		const nested = findSubtask(node.subtasks, targetId);
		if (nested) return nested;
	}
	return null;
}

export function indentSubtaskTree(nodes: Subtask[], targetId: string): Subtask[] {
	const cloned = cloneSubtasks(nodes);

	const indent = (siblings: Subtask[]): boolean => {
		for (let index = 0; index < siblings.length; index += 1) {
			const node = siblings[index];
			if (node.id === targetId) {
				if (index === 0) return false;
				const [target] = siblings.splice(index, 1);
				siblings[index - 1].subtasks.push(target);
				return true;
			}
			if (indent(node.subtasks)) return true;
		}
		return false;
	};

	return indent(cloned) ? sortSubtasksDeep(cloned) : nodes;
}

export function outdentSubtaskTree(nodes: Subtask[], targetId: string): Subtask[] {
	const cloned = cloneSubtasks(nodes);

	const outdent = (
		siblings: Subtask[],
		parentSiblings: Subtask[] | null,
		parentIndex: number
	): boolean => {
		for (let index = 0; index < siblings.length; index += 1) {
			const node = siblings[index];
			if (node.id === targetId) {
				if (!parentSiblings) return false;
				const [target] = siblings.splice(index, 1);
				parentSiblings.splice(parentIndex + 1, 0, target);
				return true;
			}
			if (outdent(node.subtasks, siblings, index)) return true;
		}
		return false;
	};

	return outdent(cloned, null, -1) ? sortSubtasksDeep(cloned) : nodes;
}

export function filterReviewSubtasks(nodes: Subtask[]): Subtask[] {
	return nodes.flatMap((node) => {
		const children = filterReviewSubtasks(node.subtasks);
		return node.reviewState === 'REQUESTED' || children.length > 0
			? [{ ...node, subtasks: children }]
			: [];
	});
}

export function getActiveSubtasks(nodes: Subtask[]): Subtask[] {
	return nodes.flatMap((node) =>
		node.archived ? [] : [{ ...node, subtasks: getActiveSubtasks(node.subtasks) }]
	);
}

export function getArchivedSubtasks(nodes: Subtask[]): Subtask[] {
	return nodes.flatMap((node) => (node.archived ? [node] : getArchivedSubtasks(node.subtasks)));
}

export function getPendingSubtasks(nodes: Subtask[]): Subtask[] {
	return nodes.flatMap((node) => [
		...(node.done || node.archived ? [] : [node]),
		...getPendingSubtasks(node.subtasks)
	]);
}

export function isTaskStale(createdAt: string, nodes: Subtask[], now = Date.now()): boolean {
	let lastActivity = new Date(createdAt).getTime();
	if (!Number.isFinite(lastActivity)) lastActivity = now;

	for (const node of nodes) {
		if (node.done && node.completedAt) {
			const completedAt = new Date(node.completedAt).getTime();
			if (Number.isFinite(completedAt)) lastActivity = Math.max(lastActivity, completedAt);
		}
		if (node.subtasks.length > 0) {
			const nestedIsStale = isTaskStale(new Date(lastActivity).toISOString(), node.subtasks, now);
			if (!nestedIsStale) return false;
		}
	}

	return now - lastActivity > 30 * 24 * 60 * 60 * 1000;
}
