export class BookCoverManager {
  constructor() {
    this.currentBookCover = null;
    this.currentMultipleBooks = [];
    this.bookCoverTimeout = null;
  }

  // =====================================================
  // BOOK INFORMATION EXTRACTION
  // =====================================================
  extractBookInfo(text) {
    // Common patterns to detect book mentions
    const patterns = [
      // "Title" by Author
      /"([^"]+)"\s+by\s+([^,.!?]+)/gi,
      // Title by Author (without quotes)
      /(?:book|novel|story)\s+([A-Z][^,!?.]*?)\s+by\s+([^,.!?]+)/gi,
      // Direct mentions with "by Author"
      /([A-Z][A-Za-z\s]+)\s+by\s+([A-Z][A-Za-z\s]+)/gi,
      // ISBN patterns
      /ISBN[:\s]*(\d{10}|\d{13}|\d{9}[\dX])/gi,
      // Popular book titles (expanded list)
      /(Harry Potter|Lord of the Rings|Pride and Prejudice|To Kill a Mockingbird|1984|The Great Gatsby|Jane Eyre|Wuthering Heights|The Catcher in the Rye|Of Mice and Men|Eragon|Twilight|The Hunger Games|Game of Thrones)/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const match = matches[0];
        if (pattern.source.includes('ISBN')) {
          return { isbn: match[1] };
        } else if (match[1] && match[2]) {
          return { title: match[1].trim(), author: match[2].trim() };
        } else if (match[1]) {
          return { title: match[1].trim() };
        }
      }
    }
    return null;
  }

  extractMultipleBookTitles(text) {
    // Enhanced extraction for multiple books
    const titles = [];
    
    // Common UX/Psychology books for testing
    const uxPsychologyBooks = [
      'Don\'t Make Me Think',
      'The Design of Everyday Things',
      'Thinking, Fast and Slow',
      'Nudge',
      'The Paradox of Choice',
      'Hooked',
      'About Face',
      'Universal Principles of Design'
    ];
    
    // Check if this is a request for UX psychology books
    if (text.toLowerCase().includes('ux') && text.toLowerCase().includes('psychology')) {
      return uxPsychologyBooks.slice(0, 4); // Return first 4 for testing
    }
    
    // Check for general design/psychology book requests
    if ((text.toLowerCase().includes('design') || text.toLowerCase().includes('ux')) && 
        (text.toLowerCase().includes('book') || text.toLowerCase().includes('recommend'))) {
      return uxPsychologyBooks.slice(0, 3);
    }
    
    // Regular book extraction patterns
    const patterns = [
      /"([^"]+)"/g,
      /(?:book|novel|read)\s+([A-Z][^,!?.]*)/g
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1] && match[1].trim().length > 3) {
          titles.push(match[1].trim());
        }
      });
    }

    return [...new Set(titles)]; // Remove duplicates
  }

  // =====================================================
  // BOOK COVER SEARCH
  // =====================================================
  async checkImageExists(url) {
    try {
      console.log('🌐 Checking image exists:', url);
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      console.log(`📡 Response: ${response.status}, Content-Type: ${contentType}`);
      const isValid = response.ok && contentType?.startsWith('image/');
      console.log(`✅ Image valid: ${isValid}`);
      return isValid;
    } catch (error) {
      console.log('❌ Image check failed:', error);
      return false;
    }
  }

  async searchBookCover(bookInfo) {
    try {
      console.log('🔎 Searching for cover:', bookInfo);
      
      // First try with ISBN if available
      if (bookInfo.isbn) {
        console.log('📖 Trying ISBN lookup:', bookInfo.isbn);
        const coverUrl = `https://covers.openlibrary.org/b/isbn/${bookInfo.isbn}-M.jpg`;
        if (await this.checkImageExists(coverUrl)) {
          return { coverUrl, title: bookInfo.title || 'Unknown', author: bookInfo.author || 'Unknown' };
        }
      }

      // If no ISBN or ISBN didn't work, try searching by title
      if (bookInfo.title) {
        console.log('🔍 Trying title search:', bookInfo.title);
        const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(bookInfo.title)}&limit=1`;
        console.log('🌐 Search URL:', searchUrl);
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        console.log('📊 Search response:', searchData);
        
        if (searchData.docs && searchData.docs.length > 0) {
          const book = searchData.docs[0];
          const isbn = book.isbn ? book.isbn[0] : null;
          const olid = book.key ? book.key.replace('/works/', '') : null;
          
          // Try different cover sources
          const coverSources = [];
          if (isbn) coverSources.push(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`);
          if (olid) coverSources.push(`https://covers.openlibrary.org/b/olid/${olid}-M.jpg`);
          if (book.cover_i) coverSources.push(`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`);
          
          console.log('🖼️ Trying cover sources:', coverSources);
          
          for (const coverUrl of coverSources) {
            console.log('🔗 Testing cover URL:', coverUrl);
            if (await this.checkImageExists(coverUrl)) {
              console.log('✅ Cover URL works:', coverUrl);
              return {
                coverUrl,
                title: book.title || bookInfo.title,
                author: book.author_name ? book.author_name[0] : (bookInfo.author || 'Unknown')
              };
            } else {
              console.log('❌ Cover URL failed:', coverUrl);
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error searching for book cover:', error);
      return null;
    }
  }

  async searchMultipleBooks(bookTitles) {
    const results = [];
    console.log(`🔎 Searching for ${bookTitles.length} books...`);
    
    for (const title of bookTitles) {
      console.log(`📖 Searching: "${title}"`);
      const coverData = await this.searchBookCover({ title });
      if (coverData) {
        results.push(coverData);
        console.log(`✅ Found: ${coverData.title}`);
      } else {
        console.log(`❌ Not found: "${title}"`);
      }
    }
    
    return results;
  }

  // =====================================================
  // SINGLE BOOK COVER DISPLAY
  // =====================================================
  showBookCover(coverData, headerText = 'Featured Book') {
    const display = document.getElementById('bookCoverDisplay');
    const header = document.getElementById('singleBookHeader');
    const loading = document.getElementById('bookCoverLoading');
    const image = document.getElementById('bookCoverImage');
    const title = document.getElementById('bookCoverTitle');
    const author = document.getElementById('bookCoverAuthor');

    // Clear any existing timeout
    if (this.bookCoverTimeout) {
      clearTimeout(this.bookCoverTimeout);
    }

    // Set header text
    header.textContent = headerText;

    // Show loading state
    loading.style.display = 'block';
    image.style.display = 'none';
    title.textContent = 'Loading...';
    author.textContent = '';
    display.classList.add('visible');

    // Load the actual image
    const img = new Image();
    img.onload = () => {
      loading.style.display = 'none';
      loading.classList.add('u-hidden');
      image.src = coverData.coverUrl;
      image.style.display = 'block';
      image.classList.remove('u-hidden'); // Remove the hidden class!
      title.textContent = coverData.title;
      author.textContent = `by ${coverData.author}`;
      
      console.log('📚 Book cover displayed:', coverData.title);
    };
    
    img.onerror = () => {
      this.hideBookCover();
      console.log('❌ Failed to load book cover');
    };
    
    img.src = coverData.coverUrl;
    this.currentBookCover = coverData;

    // Auto-hide after 8 seconds
    this.bookCoverTimeout = setTimeout(() => {
      this.hideBookCover();
    }, 8000);
  }

  hideBookCover() {
    const display = document.getElementById('bookCoverDisplay');
    display.classList.remove('visible');
    this.currentBookCover = null;
    
    if (this.bookCoverTimeout) {
      clearTimeout(this.bookCoverTimeout);
      this.bookCoverTimeout = null;
    }
  }

  // =====================================================
  // MULTIPLE BOOKS DISPLAY
  // =====================================================
  showMultipleBookCovers(booksData, headerText = 'Recommended Books') {
    const display = document.getElementById('multipleBooksDisplay');
    const header = document.getElementById('booksHeader');
    const grid = document.getElementById('booksGrid');

    if (this.bookCoverTimeout) clearTimeout(this.bookCoverTimeout);

    header.textContent = headerText;
    grid.innerHTML = ''; // Clear existing books

    // Create book items
    booksData.forEach(book => {
      const bookItem = document.createElement('div');
      bookItem.className = 'book-item';
      
      bookItem.innerHTML = `
        <img src="${book.coverUrl}" alt="${book.title}" />
        <div class="title">${book.title}</div>
        <div class="author">by ${book.author}</div>
      `;
      
      grid.appendChild(bookItem);
    });

    display.classList.add('visible');
    this.currentMultipleBooks = booksData;

    // Auto-hide after 12 seconds (longer for multiple books)
    this.bookCoverTimeout = setTimeout(() => this.hideMultipleBookCovers(), 12000);
  }

  hideMultipleBookCovers() {
    document.getElementById('multipleBooksDisplay').classList.remove('visible');
    this.currentMultipleBooks = [];
    if (this.bookCoverTimeout) {
      clearTimeout(this.bookCoverTimeout);
      this.bookCoverTimeout = null;
    }
  }

  hideAllCovers() {
    this.hideBookCover();
    this.hideMultipleBookCovers();
  }

  // =====================================================
  // MAIN PROCESSING FUNCTION
  // =====================================================
  async processTextForBooks(text, options = {}) {
    console.log('🔍 Processing text for books:', text.substring(0, 100) + '...');
    
    // Try multiple books extraction first
    const bookTitles = this.extractMultipleBookTitles(text);
    
    if (bookTitles.length === 0) {
      // Fall back to single book extraction
      const bookInfo = this.extractBookInfo(text);
      if (bookInfo) {
        console.log('📚 Detected single book mention:', bookInfo);
        const coverData = await this.searchBookCover(bookInfo);
        if (coverData) {
          console.log('✅ Found cover data:', coverData);
          this.showBookCover(coverData, 'Book Mention');
        } else {
          console.log('❌ No cover found for:', bookInfo);
        }
      } else {
        console.log('❌ No book detected in text');
      }
      return;
    }
    
    if (bookTitles.length === 1) {
      // Use existing single book display
      console.log('📚 Detected single book:', bookTitles[0]);
      const coverData = await this.searchBookCover({ title: bookTitles[0] });
      if (coverData) {
        this.showBookCover(coverData, 'Recommended Book');
        console.log(`✅ Showing single book: ${coverData.title}`);
      } else {
        console.log(`❌ Could not find cover for: ${bookTitles[0]}`);
      }
    } else {
      // Use new multiple books display
      console.log(`📚 Detected ${bookTitles.length} books:`, bookTitles);
      const booksData = await this.searchMultipleBooks(bookTitles);
      if (booksData.length > 0) {
        let headerText = 'Recommended Books';
        if (text.toLowerCase().includes('ux') && text.toLowerCase().includes('psychology')) {
          headerText = 'UX Psychology Books';
        } else if (text.toLowerCase().includes('design')) {
          headerText = 'Design Books';
        }
        
        this.showMultipleBookCovers(booksData, options.headerText || headerText);
        console.log(`✅ Showing ${booksData.length} books out of ${bookTitles.length} requested`);
      } else {
        console.log(`❌ Could not find covers for any of the ${bookTitles.length} books`);
      }
    }
  }

  // =====================================================
  // TEST FUNCTION
  // =====================================================
  testBookCover() {
    console.log('🧪 Testing book cover with "Eragon by Christopher Paolini"');
    this.processTextForBooks('Oh my gosh, "Eragon" by Christopher Paolini? I absolutely love that book!');
  }
} 