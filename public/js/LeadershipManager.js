export class LeadershipManager {
  constructor() {
    this.currentLeadershipDisplay = null;
    this.leadershipTimeout = null;
    this.leadershipData = [
      {
        name: "Lai Yee",
        title: "Chief Executive Officer",
        imageUrl: "https://temus.com/wp-content/uploads/2024/11/Lai-Yee_New-e1731295151442.jpg"
      },
      {
        name: "Melissa",
        title: "Chief People Officer",
        imageUrl: "https://temus.com/wp-content/uploads/2024/10/Melissa-Kee_Image_new-e1728369705375.jpg"
      },
      {
        name: "Chun Wei",
        title: "Managing Director, Technology",
        imageUrl: "https://temus.com/wp-content/uploads/2024/10/Wu-Chun-Wei_Image_desktop-e1730096704996.jpg"
      },
      {
        name: "Shridar",
        title: "Managing Director, Digital & Process Transformation",
        imageUrl: "https://temus.com/wp-content/uploads/2024/11/Shridar-Photo_desktop_new-e1731039658920.jpg"
      },
      {
        name: "Daniel",
        title: "Managing Director – Cloud, Application & Platform",
        imageUrl: "https://temus.com/wp-content/uploads/2023/10/Daniel-Headshot-Mobile.png"
      },
      {
        name: "Peng Hooi",
        title: "Finance Director",
        imageUrl: "https://temus.com/wp-content/uploads/2024/10/Ong-Peng-Hooi-Finance-Director-Temus-1-e1730096667616.jpg"
      },
      {
        name: "Marcus",
        title: "Director and Head of Step IT Up",
        imageUrl: "https://temus.com/wp-content/uploads/2024/11/Marcus-Photo_New-e1732259725613-751x900.jpeg"
      },
      {
        name: "Seok Ling Wong",
        title: "Managing Director – Cloud, Application & Platform",
        imageUrl: "https://temus.com/wp-content/uploads/2025/02/Wong-Seok-Ling_Temus1524-1-e1740127437314.jpg"
      },
      {
        name: "Megha",
        title: "Consulting Director for Digital Strategy & Transformation",
        imageUrl: "https://media.licdn.com/dms/image/v2/D5603AQHGcD_oAF-lhA/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1668860622719?e=1756944000&v=beta&t=GIZIcQABsGutdMnrrvZNCi8lHLKxcE2j3BJ3fL5EHsU"
      }
    ];
  }

  // =====================================================
  // LEADERSHIP DETECTION
  // =====================================================
  extractLeadershipMentions(text) {
    const lowerText = text.toLowerCase();
    
    // Exclude timesheet/system-related contexts
    const excludeKeywords = [
      'timesheet', 'time sheet', 'log hours', 'adaptive work', 'unit4', 'clarizen', 'system access',
      'portal', 'application', 'website', 'link', 'submit', 'hours'
    ];
    
    // If text contains exclusion keywords, don't show leadership
    if (excludeKeywords.some(exclude => lowerText.includes(exclude))) {
      return false;
    }
    
    const leadershipKeywords = [
      'leadership team', 'our leaders', 'management team', 'executive team', 'ceo', 
      'chief executive', 'chief people officer', 'managing director', 'finance director',
      'who is our', 'meet our', 'our management', 'company leaders',
      'lai yee', 'melissa', 'chun wei', 'shridar', 'daniel', 'peng hooi', 'marcus', 'seok ling', 'megha'
    ];
    
    return leadershipKeywords.some(keyword => lowerText.includes(keyword));
  }

  extractSpecificLeader(text) {
    const lowerText = text.toLowerCase();
    
    // Check for specific leader mentions
    for (const leader of this.leadershipData) {
      const nameLower = leader.name.toLowerCase();
      if (lowerText.includes(nameLower)) {
        return leader;
      }
    }
    
    return null;
  }

  // =====================================================
  // SINGLE LEADER DISPLAY
  // =====================================================
  showSingleLeader(leaderData, headerText = 'Leadership Team') {
    const display = document.getElementById('leadershipDisplay');
    const header = document.getElementById('singleLeaderHeader');
    const loading = document.getElementById('leadershipLoading');
    const image = document.getElementById('leadershipImage');
    const name = document.getElementById('leadershipName');
    const title = document.getElementById('leadershipTitle');

    // Clear any existing timeout
    if (this.leadershipTimeout) {
      clearTimeout(this.leadershipTimeout);
    }

    // Set header text
    header.textContent = headerText;

    // Show loading state
    loading.style.display = 'block';
    image.style.display = 'none';
    name.textContent = 'Loading...';
    title.textContent = '';
    display.classList.add('visible');

    // Load the actual image
    const img = new Image();
    img.onload = () => {
      loading.style.display = 'none';
      loading.classList.add('u-hidden');
      image.src = leaderData.imageUrl;
      image.style.display = 'block';
      image.classList.remove('u-hidden');
      name.textContent = leaderData.name;
      title.textContent = leaderData.title;
      
      console.log('👤 Leadership display shown:', leaderData.name);
    };
    
    img.onerror = () => {
      this.hideLeadershipDisplay();
      console.log('❌ Failed to load leader image');
    };
    
    img.src = leaderData.imageUrl;
    this.currentLeadershipDisplay = leaderData;

    // Auto-hide after 8 seconds
    this.leadershipTimeout = setTimeout(() => {
      this.hideLeadershipDisplay();
    }, 8000);
  }

  // =====================================================
  // MULTIPLE LEADERS DISPLAY
  // =====================================================
  showMultipleLeaders(leadersData, headerText = 'Leadership Team') {
    const display = document.getElementById('leadershipMultipleDisplay');
    const header = document.getElementById('leadershipMultipleHeader');
    const grid = document.getElementById('leadershipGrid');

    if (this.leadershipTimeout) clearTimeout(this.leadershipTimeout);

    header.textContent = headerText;
    grid.innerHTML = ''; // Clear existing leaders

    // Create leader items
    leadersData.forEach(leader => {
      const leaderItem = document.createElement('div');
      leaderItem.className = 'leadership-item';
      
      leaderItem.innerHTML = `
        <img src="${leader.imageUrl}" alt="${leader.name}" />
        <div class="name">${leader.name}</div>
        <div class="title">${leader.title}</div>
      `;
      
      grid.appendChild(leaderItem);
    });

    display.classList.add('visible');
    this.currentLeadershipDisplay = leadersData;

    // Auto-hide after 12 seconds (longer for multiple leaders)
    this.leadershipTimeout = setTimeout(() => this.hideMultipleLeadersDisplay(), 12000);
  }

  hideLeadershipDisplay() {
    const display = document.getElementById('leadershipDisplay');
    if (display) {
      display.classList.remove('visible');
    }
    this.currentLeadershipDisplay = null;
    
    if (this.leadershipTimeout) {
      clearTimeout(this.leadershipTimeout);
      this.leadershipTimeout = null;
    }
  }

  hideMultipleLeadersDisplay() {
    const display = document.getElementById('leadershipMultipleDisplay');
    if (display) {
      display.classList.remove('visible');
    }
    this.currentLeadershipDisplay = null;
    if (this.leadershipTimeout) {
      clearTimeout(this.leadershipTimeout);
      this.leadershipTimeout = null;
    }
  }

  hideAllLeadership() {
    this.hideLeadershipDisplay();
    this.hideMultipleLeadersDisplay();
  }

  // =====================================================
  // MAIN PROCESSING FUNCTION
  // =====================================================
  async processTextForLeadership(text, options = {}) {
    console.log('👥 Processing text for leadership mentions:', text.substring(0, 100) + '...');
    
    // Check for specific leader mention first
    const specificLeader = this.extractSpecificLeader(text);
    if (specificLeader) {
      console.log('👤 Specific leader detected:', specificLeader.name);
      this.showSingleLeader(specificLeader, `Meet ${specificLeader.name}`);
      return;
    }
    
    // Check for general leadership mentions
    if (this.extractLeadershipMentions(text)) {
      console.log('👥 Leadership team mention detected');
      
      // Show a subset of leaders (first 4 for better display)
      const leadersToShow = this.leadershipData.slice(0, 4);
      this.showMultipleLeaders(leadersToShow, options.headerText || 'Temus Leadership Team');
    } else {
      console.log('❌ No leadership mentions detected');
    }
  }

  // =====================================================
  // TEST FUNCTION
  // =====================================================
  testLeadershipDisplay() {
    console.log('🧪 Testing leadership display');
    this.processTextForLeadership('Tell me about our leadership team and management');
  }
}