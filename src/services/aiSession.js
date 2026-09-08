let workspace = null;
export function bindAIWorkspace(value) { workspace = value; }
export function clearAIWorkspace(epoch) { if (!epoch || workspace?.epoch === epoch) workspace = null; }
export function getAIWorkspace() { return workspace; }
