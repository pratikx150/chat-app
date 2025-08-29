// Constants and State (same as previous)


// ... (all helper functions, API calls, render functions from previous response)


// Add missing event listeners in renderUserDropdown after render
document.getElementById('themeSelect').addEventListener('change', (e) => changeTheme(e.target.value));
document.getElementById('logoutButton').addEventListener('click', logout);

// Handle paste for images
function handlePaste(e) {
    const items = e.clipboardData.items;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (!file || !username) return;
            // Upload file (similar to handleFileUpload)
        }
    }
}

// Handle file upload
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !username) return;
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    const { storageId } = await response.json();
    sendMessage('', file.type.startsWith('image/') ? 'image' : 'video', storageId);
}

// Handle send message
async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessageText.trim() && !replyingTo) return;
    if (isMuted && !newMessageText.startsWith("/")) return;
    // Detect GIF/link/sticker, etc.
    await sendMessage(newMessageText, 'text', null, null, null, replyingTo?._id, detectURL(newMessageText) ? newMessageText.match(/(https?:\/\/[^\s]+)/g)[0] : null);
    newMessageText = '';
    replyingTo = null;
    renderInput();
}

// Initial
renderApp();
if (username) fetchData();

setInterval(() => currentTime = Date.now(), 1000);
