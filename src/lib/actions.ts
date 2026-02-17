export function autosize(node: HTMLTextAreaElement, _dep?: any) {
    const resize = () => {
        node.style.height = 'auto';
        node.style.height = node.scrollHeight + 'px';
    };
    node.addEventListener('input', resize);
    // Timeout wichtig für Svelte Rendering Cycle
    setTimeout(resize, 0);
    
    return {
        update() { resize(); },
        destroy() { node.removeEventListener('input', resize); }
    };
}

export function focusOnMount(node: HTMLElement) {
    node.focus();
}