/**
 * Hands Free Studio Ã¢â‚¬â€ Website Templates
 * Pre-built starting points for common project types.
 * The Architect can reference these when planning a new project.
 * Hands Free v7 Ã¢â‚¬â€ Session 15
 */

export interface HandsFreeStudioTemplate {
    id: string;
    name: string;
    description: string;
    techStack: string;
    files: string[];
    starterHtml: string;
}

export const HANDSFREE_STUDIO_TEMPLATES: HandsFreeStudioTemplate[] = [
    {
        id: 'static-landing',
        name: 'Static Landing Page',
        description: 'A modern, responsive single-page landing page with hero, features, testimonials, and CTA sections.',
        techStack: 'HTML5, CSS3 (Flexbox + Grid), Vanilla JS',
        files: ['index.html', 'styles.css', 'script.js'],
        starterHtml: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PROJECT_NAME}}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav class="navbar">
        <div class="container">
            <a href="#" class="logo">{{PROJECT_NAME}}</a>
            <ul class="nav-links">
                <li><a href="#features">Features</a></li>
                <li><a href="#testimonials">Testimonials</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </div>
    </nav>
    <section class="hero">
        <div class="container">
            <h1>Welcome to {{PROJECT_NAME}}</h1>
            <p>Your compelling tagline goes here.</p>
            <a href="#contact" class="btn-primary">Get Started</a>
        </div>
    </section>
    <section id="features" class="features">
        <div class="container">
            <h2>Features</h2>
            <div class="features-grid"></div>
        </div>
    </section>
    <section id="testimonials" class="testimonials">
        <div class="container">
            <h2>What People Say</h2>
        </div>
    </section>
    <section id="contact" class="cta">
        <div class="container">
            <h2>Ready to Start?</h2>
            <a href="mailto:hello@example.com" class="btn-primary">Contact Us</a>
        </div>
    </section>
    <footer><p>&copy; 2026 {{PROJECT_NAME}}</p></footer>
    <script src="script.js"></script>
</body>
</html>`,
    },
    {
        id: 'php-contact',
        name: 'PHP Contact Form',
        description: 'A multi-page site with a working PHP contact form, validation, and email sending.',
        techStack: 'HTML5, CSS3, PHP 8, Vanilla JS',
        files: ['index.html', 'contact.php', 'styles.css', 'script.js', 'thank-you.html'],
        starterHtml: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PROJECT_NAME}} Ã¢â‚¬â€ Contact</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav class="navbar">
        <a href="index.html" class="logo">{{PROJECT_NAME}}</a>
        <ul class="nav-links">
            <li><a href="index.html">Home</a></li>
            <li><a href="contact.php">Contact</a></li>
        </ul>
    </nav>
    <main class="container">
        <h1>Contact Us</h1>
        <form action="contact.php" method="POST" class="contact-form">
            <label for="name">Name</label>
            <input type="text" id="name" name="name" required>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required>
            <label for="message">Message</label>
            <textarea id="message" name="message" rows="5" required></textarea>
            <button type="submit" class="btn-primary">Send Message</button>
        </form>
    </main>
    <script src="script.js"></script>
</body>
</html>`,
    },
    {
        id: 'portfolio',
        name: 'Portfolio / Personal Site',
        description: 'A creative portfolio with project gallery, about section, and smooth scroll animations.',
        techStack: 'HTML5, CSS3 (Grid + Animations), Vanilla JS',
        files: ['index.html', 'projects.html', 'about.html', 'styles.css', 'script.js'],
        starterHtml: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PROJECT_NAME}} Ã¢â‚¬â€ Portfolio</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav class="navbar">
        <a href="index.html" class="logo">{{PROJECT_NAME}}</a>
        <ul class="nav-links">
            <li><a href="index.html">Home</a></li>
            <li><a href="projects.html">Projects</a></li>
            <li><a href="about.html">About</a></li>
        </ul>
    </nav>
    <section class="hero portfolio-hero">
        <h1>Hi, I'm {{PROJECT_NAME}}</h1>
        <p>Designer &amp; Developer</p>
    </section>
    <section class="projects-grid">
        <div class="project-card">
            <h3>Project 1</h3>
            <p>Description of your work.</p>
        </div>
    </section>
    <footer><p>&copy; 2026 {{PROJECT_NAME}}</p></footer>
    <script src="script.js"></script>
</body>
</html>`,
    },
    {
        id: 'blog-static',
        name: 'Static Blog',
        description: 'A clean, readable blog with index page, individual post pages, and a responsive layout.',
        techStack: 'HTML5, CSS3 (Typography-focused), Vanilla JS',
        files: ['index.html', 'post.html', 'styles.css', 'script.js'],
        starterHtml: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PROJECT_NAME}} Ã¢â‚¬â€ Blog</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav class="navbar">
        <a href="index.html" class="logo">{{PROJECT_NAME}}</a>
        <ul class="nav-links">
            <li><a href="index.html">Home</a></li>
            <li><a href="#archive">Archive</a></li>
        </ul>
    </nav>
    <main class="blog-container">
        <article class="post-preview">
            <h2><a href="post.html">First Blog Post</a></h2>
            <time>March 2026</time>
            <p>A short excerpt of the blog post content goes here...</p>
            <a href="post.html" class="read-more">Read more &rarr;</a>
        </article>
    </main>
    <footer><p>&copy; 2026 {{PROJECT_NAME}}</p></footer>
    <script src="script.js"></script>
</body>
</html>`,
    },
];

/** Look up a template by ID */
export function getTemplate(id: string): HandsFreeStudioTemplate | undefined {
    return HANDSFREE_STUDIO_TEMPLATES.find(t => t.id === id);
}

/** Get a concise summary of all templates for Architect context */
export function getTemplatesSummary(): string {
    return HANDSFREE_STUDIO_TEMPLATES
        .map(t => `- **${t.name}** (${t.id}): ${t.description} [${t.techStack}]`)
        .join('\n');
}
