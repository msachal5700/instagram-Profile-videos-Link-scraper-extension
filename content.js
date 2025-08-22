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
    /youtube\.com\/shorts\//,
    /vimeo\.com\/\d+/,
    /dailymotion\.com\/video\//,
    /twitch\.tv\/videos\//,
    /facebook\.com\/.*\/videos\//,
    /instagram\.com\/p\//,
    /instagram\.com\/reel\//,
    /instagram\.com\/tv\//,
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

// Instagram specific selectors
const INSTAGRAM_SELECTORS = [
    'article a[href*="/p/"]',
    'article a[href*="/reel/"]',
    'article a[href*="/tv/"]',
    'a[href*="/p/"]',
    'a[href*="/reel/"]',
    'a[href*="/tv/"]',
    '[role="link"][href*="/p/"]',
    '[role="link"][href*="/reel/"]'
];

// YouTube specific selectors
const YOUTUBE_SELECTORS = [
    'a[href*="/watch?v="]',
    'a[href*="/shorts/"]',
    'a[href*="youtu.be/"]',
    '[href*="/watch?v="]',
    '[href*="/shorts/"]',
    '[href*="youtu.be/"]'
];

// TikTok specific selectors
const TIKTOK_SELECTORS = [
    'a[href*="/video/"]',
    '[href*="/video/"]',
    'a[href*="tiktok.com/"]'
];

function extractVideoLinks() {
    const newLinks = new Set();
    
    // Get all video elements and their sources
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
    
    // Instagram specific extraction
    if (window.location.hostname.includes('instagram.com')) {
        extractInstagramLinks(newLinks);
    }
    
    // YouTube specific extraction
    if (window.location.hostname.includes('youtube.com')) {
        extractYouTubeLinks(newLinks);
    }
    
    // TikTok specific extraction
    if (window.location.hostname.includes('tiktok.com')) {
        extractTikTokLinks(newLinks);
    }
    
    // General link extraction
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
    const elementsWithData = document.querySelectorAll('[data-src], [data-video], [data-url], [data-href], [data-link]');
    elementsWithData.forEach(el => {
        ['data-src', 'data-video', 'data-url', 'data-href', 'data-link'].forEach(attr => {
            const value = el.getAttribute(attr);
            if (value) {
                if (VIDEO_EXTENSIONS.some(ext => value.toLowerCase().includes(ext)) ||
                    STREAMING_PATTERNS.some(pattern => pattern.test(value))) {
                    newLinks.add(value);
                }
            }
        });
    });
    
    // Check all elements with various attributes
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        // Check for any attribute that might contain video links
        Array.from(el.attributes).forEach(attr => {
            if (attr.value && typeof attr.value === 'string') {
                if (VIDEO_EXTENSIONS.some(ext => attr.value.toLowerCase().includes(ext)) ||
                    STREAMING_PATTERNS.some(pattern => pattern.test(attr.value))) {
                    newLinks.add(attr.value);
                }
            }
        });
    });
    
    // Add new links to our main set
    newLinks.forEach(link => {
        if (link && link.startsWith('http') && !videoLinks.has(link)) {
            videoLinks.add(link);
        }
    });
}

function extractInstagramLinks(newLinks) {
    // Instagram post/reel links
    INSTAGRAM_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const href = el.href || el.getAttribute('href');
            if (href && href.includes('instagram.com')) {
                newLinks.add(href);
            }
        });
    });
    
    // Look for Instagram URLs in text content and data attributes
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        // Check data attributes
        Array.from(el.attributes).forEach(attr => {
            if (attr.value && attr.value.includes('instagram.com/p/') || 
                attr.value && attr.value.includes('instagram.com/reel/') ||
                attr.value && attr.value.includes('instagram.com/tv/')) {
                newLinks.add(attr.value);
            }
        });
    });
    
    // Extract from current URL if it's an Instagram video
    if (window.location.href.includes('instagram.com/p/') || 
        window.location.href.includes('instagram.com/reel/') ||
        window.location.href.includes('instagram.com/tv/')) {
        newLinks.add(window.location.href);
    }
}

function extractYouTubeLinks(newLinks) {
    // YouTube video links
    YOUTUBE_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const href = el.href || el.getAttribute('href');
            if (href) {
                if (href.includes('youtube.com') || href.includes('youtu.be')) {
                    newLinks.add(href);
                } else if (href.startsWith('/watch?v=') || href.startsWith('/shorts/')) {
                    newLinks.add('https://www.youtube.com' + href);
                }
            }
        });
    });
    
    // Extract from current URL if it's a YouTube video
    if (window.location.href.includes('youtube.com/watch') || 
        window.location.href.includes('youtube.com/shorts') ||
        window.location.href.includes('youtu.be/')) {
        newLinks.add(window.location.href);
    }
}

function extractTikTokLinks(newLinks) {
    // TikTok video links
    TIKTOK_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const href = el.href || el.getAttribute('href');
            if (href && href.includes('tiktok.com')) {
                newLinks.add(href);
            }
        });
    });
    
    // Extract from current URL if it's a TikTok video
    if (window.location.href.includes('tiktok.com/') && 
        window.location.href.includes('/video/')) {
        newLinks.add(window.location.href);
    }
}

function scrollToBottom() {
    return new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 100;
        let scrollDelay = 200; // Increased delay for better loading
        let lastHeight = 0;
        let stuckCount = 0;
        
        const scrollTimer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            // Extract video links during scroll
            extractVideoLinks();
            
            // Check if we're stuck (page not growing)
            if (scrollHeight === lastHeight) {
                stuckCount++;
                if (stuckCount > 10) { // If stuck for 10 iterations, try to load more
                    triggerInfiniteScroll();
                    stuckCount = 0;
                }
            } else {
                stuckCount = 0;
            }
            lastHeight = scrollHeight;
            
            if (totalHeight >= scrollHeight || !isGrabbing) {
                clearInterval(scrollTimer);
                resolve();
            }
        }, scrollDelay);
    });
}

function triggerInfiniteScroll() {
    // Try to trigger infinite scroll by various methods
    
    // Method 1: Scroll to very bottom
    window.scrollTo(0, document.body.scrollHeight);
    
    // Method 2: Trigger scroll events
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
    
    // Method 3: Click "Load More" buttons if they exist
    const loadMoreButtons = document.querySelectorAll(
        'button[data-testid*="load"], button[aria-label*="load"], button[aria-label*="more"], ' +
        'button:contains("Load"), button:contains("More"), button:contains("Show"), ' +
        '[role="button"][aria-label*="load"], [role="button"][aria-label*="more"]'
    );
    
    loadMoreButtons.forEach(button => {
        if (button.offsetParent !== null) { // Check if visible
            button.click();
        }
    });
    
    // Method 4: For Instagram specifically
    if (window.location.hostname.includes('instagram.com')) {
        // Look for Instagram's load more elements
        const instagramLoadMore = document.querySelectorAll(
            'button[aria-label*="Load"], [role="button"][aria-label*="Load"], ' +
            'button:contains("Load more"), button:contains("Show more")'
        );
        instagramLoadMore.forEach(button => {
            if (button.offsetParent !== null) {
                button.click();
            }
        });
    }
    
    // Method 5: Simulate user interaction to trigger lazy loading
    const event = new MouseEvent('mouseover', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    document.body.dispatchEvent(event);
}

function startGrabbing() {
    if (isGrabbing) return;
    
    isGrabbing = true;
    videoLinks.clear();
    
    // Initial extraction
    extractVideoLinks();
    
    // Set up continuous extraction during scrolling
    const extractionInterval = setInterval(() => {
        if (isGrabbing) {
            extractVideoLinks();
        } else {
            clearInterval(extractionInterval);
        }
    }, 500);
    
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
        // Continue extracting for a bit after scrolling completes
        let finalExtractionCount = 0;
        const finalExtraction = setInterval(() => {
            extractVideoLinks();
            finalExtractionCount++;
            
            if (finalExtractionCount >= 5) { // Extract 5 more times
                clearInterval(finalExtraction);
                
                // Final message update
                chrome.runtime.sendMessage({
                    action: 'updateProgress',
                    videos: Array.from(videoLinks),
                    pageHeight: document.body.scrollHeight
                });
                
                stopGrabbing();
            }
        }, 1000);
    });
}

// Enhanced mutation observer for dynamic content
const observer = new MutationObserver((mutations) => {
    if (isGrabbing) {
        let shouldExtract = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldExtract = true;
            }
        });
        
        if (shouldExtract) {
            setTimeout(() => {
                extractVideoLinks();
            }, 100);
        }
    }
});

// Start observing when page loads
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Enhanced URL change detection for SPAs
let lastUrl = location.href;
const urlCheckInterval = setInterval(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        if (!isGrabbing) {
            setTimeout(() => {
                extractVideoLinks();
            }, 1000);
        }
    }
}, 1000);

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
    setTimeout(() => {
        extractVideoLinks();
    }, 2000);
});

// Extract videos on page load complete
window.addEventListener('load', () => {
    setTimeout(() => {
        extractVideoLinks();
    }, 3000);
});

// Extract videos on focus (when user comes back to tab)
window.addEventListener('focus', () => {
    if (!isGrabbing) {
        setTimeout(() => {
            extractVideoLinks();
        }, 1000);
    }
});