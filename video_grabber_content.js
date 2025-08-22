// Video Link Grabber Content Script
let isGrabbing = false;
let videoLinks = new Set();
let scrollInterval;
let progressInterval;

// Video file extensions and streaming patterns
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.ogv'];
const STREAMING_PATTERNS = [
    /youtube\.com\/watch\?v=/,
    /youtu\.be\//,
    /vimeo\.com\/\d+/,
    /dailymotion\.com\/video\//,
    /twitch\.tv\/videos\//,
    /facebook\.com\/.*\/videos\//,
    /instagram\.com\/p\/.*\/$/,
    /tiktok\.com\/.*\/video\//,
    /twitter\.com\/.*\/status\/.*$/,
    /x\.com\/.*\/status\/.*$/,
    /streamable\.com\//,
    /streamja\.com\//,
    /video\./,
    /stream\./,
    /\.m3u8/,
    /\.mpd/
];

function extractVideoLinks() {
    const newLinks = new Set();
    
    // Get all video elements
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
        if (video.src) newLinks.add(video.src);
        if (video.currentSrc) newLinks.add(video.currentSrc);
        
        // Check source elements
        const sources = video.querySelectorAll('source');
        sources.forEach(source => {
            if (source.src) newLinks.add(source.src);
        });
    });
    
    // Get all links
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        const href = link.href;
        
        // Check for video file extensions
        if (VIDEO_EXTENSIONS.some(ext => href.toLowerCase().includes(ext))) {
            newLinks.add(href);
        }
        
        // Check for streaming platforms
        if (STREAMING_PATTERNS.some(pattern => pattern.test(href))) {
            newLinks.add(href);
        }
    });
    
    // Check for embedded video iframes
    const iframes = document.querySelectorAll('iframe[src]');
    iframes.forEach(iframe => {
        const src = iframe.src;
        if (STREAMING_PATTERNS.some(pattern => pattern.test(src))) {
            newLinks.add(src);
        }
    });
    
    // Check for data attributes that might contain video URLs
    const elementsWithData = document.querySelectorAll('[data-src], [data-video], [data-url], [data-href]');
    elementsWithData.forEach(el => {
        ['data-src', 'data-video', 'data-url', 'data-href'].forEach(attr => {
            const value = el.getAttribute(attr);
            if (value) {
                if (VIDEO_EXTENSIONS.some(ext => value.toLowerCase().includes(ext)) ||
                    STREAMING_PATTERNS.some(pattern => pattern.test(value))) {
                    newLinks.add(value);
                }
            }
        });
    });
    
    // Add new links to our main set
    newLinks.forEach(link => {
        if (link && !videoLinks.has(link)) {
            videoLinks.add(link);
        }
    });
}

function scrollToBottom() {
    return new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 100;
        let scrollDelay = 100;
        
        const scrollTimer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            // Extract video links during scroll
            extractVideoLinks();
            
            if (totalHeight >= scrollHeight || !isGrabbing) {
                clearInterval(scrollTimer);
                resolve();
            }
        }, scrollDelay);
    });
}

function startGrabbing() {
    if (isGrabbing) return;
    
    isGrabbing = true;
    videoLinks.clear();
    
    // Initial extraction
    extractVideoLinks();
    
    // Start progress reporting
    progressInterval = setInterval(() => {
        chrome.runtime.sendMessage({
            action: 'updateProgress',
            videos: Array.from(videoLinks),
            pageHeight: document.body.scrollHeight
        });
    }, 1000);
    
    // Start scrolling and grabbing
    scrollToBottom().then(() => {
        // Final extraction after scrolling
        extractVideoLinks();
        
        // Wait a bit for any lazy-loaded content
        setTimeout(() => {
            extractVideoLinks();
            
            chrome.runtime.sendMessage({
                action: 'updateProgress',
                videos: Array.from(videoLinks),
                pageHeight: document.body.scrollHeight
            });
            
            stopGrabbing();
        }, 2000);
    });
}

function stopGrabbing() {
    isGrabbing = false;
    
    if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }
    
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.action) {
        case 'startGrabbing':
            startGrabbing();
            sendResponse({success: true});
            break;
            
        case 'stopGrabbing':
            stopGrabbing();
            sendResponse({success: true});
            break;
            
        case 'checkStatus':
            sendResponse({
                isRunning: isGrabbing,
                videos: Array.from(videoLinks)
            });
            break;
    }
});

// Auto-extract videos when page loads
document.addEventListener('DOMContentLoaded', () => {
    extractVideoLinks();
});

// Extract videos when page changes (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        if (!isGrabbing) {
            extractVideoLinks();
        }
    }
}).observe(document, {subtree: true, childList: true});