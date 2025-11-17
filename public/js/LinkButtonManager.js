export class LinkButtonManager {
  constructor() {
    this.currentButtons = [];
    this.buttonTimeout = null;
    
    // URL mappings for button names
    this.buttonUrlMappings = {
      'Time Sheet': 'https://app2.clarizen.com/Clarizen/Pages/Service/Login.aspx?ReturnUrl=%2fClarizen%2fPanels%2fCustomPage%2fTemusHomePageTeamMember%3forgId%3d39640257&orgId=39640257',
      'Darwinbox': 'https://temus.darwinbox.in/',
      'MediHub': 'https://medihub.com.sg/',
      'Unit4': 'https://temus.u4sm.com/',
      'People Orbit': 'https://peopleorbit.temus.com/',
      'User Guides': 'https://peopleorbit.temus.com/user_guides',
      'Employee Handbook': 'https://peopleorbit.temus.com/employee_handbook',
      'Benefits': 'https://peopleorbit.temus.com/benefits'
    };
  }

  // =====================================================
  // URL EXTRACTION
  // =====================================================
  extractBracketedUrls(text) {
    // Match URLs in brackets like [https://example.com], [Button Name|https://example.com], or [Button Name]
    const urlPattern = /\[([^\]]+)\]/g;
    const urls = [];
    let match;
    
    while ((match = urlPattern.exec(text)) !== null) {
      const content = match[1];
      
      // Check if it's in the format [Button Name|URL]
      if (content.includes('|')) {
        const [customName, url] = content.split('|', 2);
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          urls.push({
            originalText: match[0], // Full bracketed text
            url: url.trim(),
            buttonName: customName.trim()
          });
        }
      } else if (content.startsWith('http://') || content.startsWith('https://')) {
        // Original format [URL]
        urls.push({
          originalText: match[0], // Full bracketed text like [https://example.com]
          url: content,
          buttonName: this.generateButtonName(content)
        });
      } else {
        // New format [Button Name] - lookup URL from mappings
        const buttonName = content.trim();
        console.log(`🔍 Looking up button: "${buttonName}"`);
        console.log('📋 Available mappings:', Object.keys(this.buttonUrlMappings));
        if (this.buttonUrlMappings[buttonName]) {
          console.log(`✅ Found mapping for "${buttonName}":`, this.buttonUrlMappings[buttonName]);
          urls.push({
            originalText: match[0],
            url: this.buttonUrlMappings[buttonName],
            buttonName: buttonName
          });
        } else {
          console.log(`❌ No mapping found for "${buttonName}"`);
        }
      }
    }
    
    return urls;
  }

  generateButtonName(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      
      // Special cases for known domains
      const domainMappings = {
        'temus.darwinbox.in': 'Go to Darwinbox',
        'medihub.com.sg': 'Go to MediHub',
        'temus.u4sm.com': 'Go to Unit4',
        'temus.com.sg': 'Visit Temus Website',
        'peopleorbit.temus.com': 'Go to People Orbit'
      };
      
      if (domainMappings[domain]) {
        return domainMappings[domain];
      }
      
      // Handle specific paths
      if (domain.includes('peopleorbit.temus.com')) {
        if (url.includes('/user_guides')) return 'View User Guides';
        if (url.includes('/employee_handbook')) return 'View Employee Handbook';
        if (url.includes('/benefits')) return 'View Benefits';
        return 'Go to People Orbit';
      }
      
      // Generic button name
      const siteName = domain.split('.')[0];
      return `Go to ${siteName.charAt(0).toUpperCase() + siteName.slice(1)}`;
    } catch (error) {
      console.error('Error generating button name:', error);
      return 'Open Link';
    }
  }

  // =====================================================
  // BUTTON DISPLAY
  // =====================================================
  showLinkButtons(urlsData) {
    if (urlsData.length === 0) return;

    const container = document.getElementById('linkButtonsContainer');
    if (!container) {
      console.error('Link buttons container not found');
      return;
    }

    // Clear existing buttons
    container.innerHTML = '';
    
    // Clear any existing timeout
    if (this.buttonTimeout) {
      clearTimeout(this.buttonTimeout);
    }

    // Create buttons
    urlsData.forEach((urlData, index) => {
      const button = document.createElement('button');
      button.className = 'link-button';
      button.textContent = urlData.buttonName;
      button.setAttribute('data-url', urlData.url);
      button.setAttribute('tabindex', '0');
      
      // Add click handler
      button.addEventListener('click', () => {
        this.handleButtonClick(urlData.url, urlData.buttonName);
      });
      
      // Add keyboard support
      button.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleButtonClick(urlData.url, urlData.buttonName);
        }
      });
      
      // Add animation delay for staggered appearance
      button.style.animationDelay = `${index * 0.1}s`;
      
      container.appendChild(button);
    });

    // Show container
    container.classList.add('visible');
    this.currentButtons = urlsData;
    
    console.log(`🔗 Showing ${urlsData.length} link buttons`);

    // Auto-hide after 15 seconds
    this.buttonTimeout = setTimeout(() => {
      this.hideLinkButtons();
    }, 15000);
  }

  handleButtonClick(url, buttonName) {
    console.log(`🔗 Button clicked: ${buttonName} -> ${url}`);
    
    // Open URL in new tab/window
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // Optional: Hide buttons after click
    this.hideLinkButtons();
  }

  hideLinkButtons() {
    const container = document.getElementById('linkButtonsContainer');
    if (container) {
      container.classList.remove('visible');
    }
    
    this.currentButtons = [];
    
    if (this.buttonTimeout) {
      clearTimeout(this.buttonTimeout);
      this.buttonTimeout = null;
    }
  }

  // =====================================================
  // TEXT FILTERING FOR SPEECH
  // =====================================================
  filterBracketedContent(text) {
    // Remove all bracketed content from text before it's spoken
    return text.replace(/\[([^\]]+)\]/g, '').trim();
  }

  // =====================================================
  // MAIN PROCESSING FUNCTION
  // =====================================================
  processTextForLinks(text) {
    console.log('🔗 Processing text for links:', text.substring(0, 100) + '...');
    
    const urlsData = this.extractBracketedUrls(text);
    
    if (urlsData.length > 0) {
      console.log(`🔗 Found ${urlsData.length} links:`, urlsData.map(u => u.buttonName));
      this.showLinkButtons(urlsData);
    } else {
      console.log('❌ No bracketed URLs found');
    }
    
    return urlsData;
  }

  // =====================================================
  // TEST FUNCTION
  // =====================================================
  testLinkButtons() {
    console.log('🧪 Testing link buttons');
    const testText = 'Go to our Clarizen timesheet portal... here I\'ll give you the link [Time Sheet]';
    console.log('Original text:', testText);
    console.log('Filtered text:', this.filterBracketedContent(testText));
    this.processTextForLinks(testText);
  }
}