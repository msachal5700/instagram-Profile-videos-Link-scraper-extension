document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const videoCount = document.getElementById('videoCount');
    const pageHeight = document.getElementById('pageHeight');
    
    let isRunning = false;
    let videoLinks = [];
    
    startBtn.addEventListener('click', startGrabbing);
    stopBtn.addEventListener('click', stopGrabbing);
    exportBtn.addEventListener('click', exportLinks);
    
    function startGrabbing() {
        isRunning = true;
        videoLinks = [];
        updateUI();
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'startGrabbing'});
        });
    }
    
    function stopGrabbing() {
        isRunning = false;
        updateUI();
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'stopGrabbing'});
        });
    }
    
    function exportLinks() {
        if (videoLinks.length === 0) {
            alert('No video links found to export!');
            return;
        }
        
        const text = videoLinks.join('\n');
        const blob = new Blob([text], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `video_links_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    function updateUI() {
        if (isRunning) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            exportBtn.style.display = 'none';
            status.textContent = 'Grabbing videos...';
            status.className = 'status running';
        } else {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            exportBtn.style.display = videoLinks.length > 0 ? 'block' : 'none';
            status.textContent = videoLinks.length > 0 ? 'Completed!' : 'Ready to start';
            status.className = videoLinks.length > 0 ? 'status completed' : 'status idle';
        }
        
        videoCount.textContent = videoLinks.length;
        
        if (videoLinks.length > 0) {
            results.style.display = 'block';
            results.innerHTML = videoLinks.map(link => 
                `<div class="video-link">${link}</div>`
            ).join('');
        } else {
            results.style.display = 'none';
        }
    }
    
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateProgress') {
            videoLinks = request.videos;
            pageHeight.textContent = request.pageHeight;
            updateUI();
        }
    });
    
    // Check if grabbing is already in progress
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'checkStatus'}, function(response) {
            if (response && response.isRunning) {
                isRunning = true;
                videoLinks = response.videos || [];
                updateUI();
            }
        });
    });
});