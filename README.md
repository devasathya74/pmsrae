# पुलिस मॉडर्न स्कूल, रायबरेली - Website Documentation

## 📋 Project Overview

This is a comprehensive, modern website for **Police Modern School, Raebareli** - a primary school (Pre-Nursery to Class 5) located within the 25th Battalion PAC campus.

## ✨ Features Implemented

### 🎯 Core Features
- ✅ **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- ✅ **Progressive Web App (PWA)** - Installable, works offline
- ✅ **SEO Optimized** - Complete meta tags, structured data, Open Graph
- ✅ **Multilingual Support** - Hindi (primary) with English support
- ✅ **Accessibility** - WCAG compliant, screen reader friendly
- ✅ **Performance Optimized** - Lazy loading, caching, minification

### 📄 Pages
1. **index.html** - Enhanced homepage with all sections
2. **pages/login.html** - Parent portal login
3. **pages/admission.html** - Multi-step online admission form
4. **pages/fee-structure.html** - (To be created)
5. **pages/privacy-policy.html** - (To be created)
6. **pages/terms.html** - (To be created)

### 🎨 New Sections Added to Homepage

#### 1. Statistics Counter
- Animated counters showing:
  - Total students (500+)
  - Faculty members (25+)
  - Years of experience (15+)
  - Success rate (100%)

#### 2. Principal's Message
- Photo and welcome message
- Vision and mission statement
- Professional layout

#### 3. Testimonials Carousel
- Auto-rotating parent reviews
- Star ratings
- Smooth transitions

#### 4. FAQ Accordion
- 6 common questions with expandable answers
- Smooth animations
- Easy to navigate

#### 5. Downloads Section
- Admission form PDF
- Prospectus
- Fee structure
- Academic calendar
- Rules & regulations
- Uniform guide

#### 6. Google Maps Integration
- Embedded map showing school location
- Interactive and responsive

#### 7. WhatsApp Floating Button
- Direct WhatsApp contact
- Pre-filled message
- Always visible

### 🛠️ Technical Implementation

#### Files Structure
```
pms/
├── index.html (Enhanced)
├── manifest.json (PWA)
├── service-worker.js (Offline support)
├── assets/
│   ├── css/
│   │   └── main.css (Custom styles)
│   ├── js/
│   │   └── main.js (All JavaScript functionality)
│   ├── images/
│   │   ├── logo/
│   │   ├── gallery/
│   │   ├── faculty/
│   │   └── achievements/
│   └── downloads/
│       └── (PDF files)
└── pages/
    ├── login.html
    ├── admission.html
    ├── fee-structure.html
    ├── privacy-policy.html
    └── terms.html
```

#### CSS Features (main.css)
- Lightbox for gallery images
- Timeline design for events
- FAQ accordion styles
- Testimonial carousel
- Multi-step form progress bar
- Download cards
- Dark mode support
- Responsive utilities

#### JavaScript Features (main.js)
- **Gallery Lightbox** - Click to enlarge images, keyboard navigation
- **Animated Counters** - Count up animation on scroll
- **FAQ Accordion** - Smooth expand/collapse
- **Testimonial Carousel** - Auto-rotating with manual controls
- **Form Auto-save** - Saves form data to localStorage
- **Dark Mode Toggle** - Switch between light/dark themes
- **Language Switcher** - Hindi/English toggle
- **Lazy Loading** - Images load as you scroll
- **Back to Top Button** - Smooth scroll to top
- **Analytics Tracking** - Google Analytics integration
- **Service Worker** - PWA offline support

### 🔒 SEO & Performance

#### Meta Tags
- Title, description, keywords
- Open Graph (Facebook)
- Twitter Cards
- Canonical URLs
- Theme color for mobile browsers

#### Structured Data (Schema.org)
- School type
- Address and location
- Contact information
- Opening hours
- Ratings

#### PWA Features
- Manifest.json for installation
- Service worker for offline access
- App icons (72x72 to 512x512)
- Splash screens
- Background sync

### 📱 Responsive Design
- Mobile-first approach
- Breakpoints: 320px, 768px, 1024px, 1280px+
- Touch-friendly buttons and links
- Optimized images for different screen sizes

### ♿ Accessibility
- ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- Focus indicators
- Color contrast compliance (WCAG AA)
- Alt text for all images

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Web server (for testing PWA features)
- Optional: Firebase account (for backend)

### Installation

1. **Clone or download the project**
   ```bash
   cd c:\Users\HP\Desktop\scripts\pms
   ```

2. **Open with a local server**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

### Configuration

#### 1. Update Contact Information
Edit `index.html` and replace placeholder contact details:
- Phone: `+91 98765 43210`
- Email: `info@pmsraebareli.online`
- Address: Update with actual address

#### 2. Google Maps
Replace the Google Maps embed URL in `index.html` with actual coordinates:
```html
<iframe src="YOUR_GOOGLE_MAPS_EMBED_URL"></iframe>
```

#### 3. Google Analytics
Replace `G-XXXXXXXXXX` with your actual Google Analytics ID in `index.html`

#### 4. EmailJS (Contact Form)
1. Sign up at [EmailJS.com](https://www.emailjs.com/)
2. Get your Service ID, Template ID, and Public Key
3. Update in `assets/js/main.js`:
   ```javascript
   const serviceID = 'YOUR_SERVICE_ID';
   const templateID = 'YOUR_TEMPLATE_ID';
   const publicKey = 'YOUR_PUBLIC_KEY';
   ```

#### 5. WhatsApp Number
Update WhatsApp number in `index.html`:
```html
<a href="https://wa.me/91XXXXXXXXXX?text=...">
```

## 📦 Dependencies

### External Libraries (CDN)
- **Tailwind CSS** - Utility-first CSS framework
- **Font Awesome** - Icons
- **Google Fonts** - Tiro Devanagari Hindi, Kalam
- **AOS** - Animate On Scroll library

### No Build Process Required!
All dependencies are loaded via CDN, so no npm install or build step is needed.

## 🎨 Customization

### Colors
Update Tailwind config in `index.html`:
```javascript
colors: {
    primary: '#1e3a8a',    // Deep blue
    secondary: '#facc15',  // Yellow
    accent: '#3b82f6',     // Light blue
}
```

### Fonts
Change fonts in the `<head>` section:
```html
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap" rel="stylesheet">
```

### Images
Replace placeholder images with actual school photos:
- Gallery images: `assets/images/gallery/`
- Faculty photos: `assets/images/faculty/`
- Logos: `assets/images/logo/`

## 🔧 Features to Complete

### High Priority
- [ ] Add real school photos
- [ ] Create actual PDF documents for downloads
- [ ] Set up EmailJS for contact form
- [ ] Configure Google Analytics
- [ ] Update Google Maps with correct location

### Medium Priority
- [ ] Create fee-structure.html page
- [ ] Create privacy-policy.html page
- [ ] Create terms.html page
- [ ] Add more gallery images (categorized)
- [ ] Implement payment gateway (optional)

### Low Priority
- [ ] Add more testimonials
- [ ] Create faculty profiles section
- [ ] Add news/events blog
- [ ] Implement search functionality
- [ ] Add chatbot integration

## 📊 Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Known Issues
- Image generation failed (use placeholder images for now)
- PDF downloads need to be created manually
- EmailJS needs configuration for contact form to work

## 📝 License
This project is created for Police Modern School, Raebareli.

## 👥 Support
For technical support or questions:
- Email: info@pmsraebareli.online
- Phone: +91 98765 43210

## 🎉 Credits
- Developed by: Sathya Deva
- Design: Modern, responsive, accessible
- Framework: Tailwind CSS
- Icons: Font Awesome

---

**Last Updated:** January 30, 2026
**Version:** 1.0.0
#   p m s r a e b a r e l i  
 