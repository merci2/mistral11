// src/pages/Blog.tsx
const Blog = () => {
  return (
    <div className="page">
      <div className="container">
        <h1>Blog</h1>
        <div className="blog-posts">
          <article className="blog-post">
            <h3>Getting Started with React</h3>
            <p>Learn the basics of React development...</p>
            <span className="date">March 15, 2024</span>
          </article>
          <article className="blog-post">
            <h3>Best Practices for Web Development</h3>
            <p>Tips and tricks for better web development...</p>
            <span className="date">March 10, 2024</span>
          </article>
        </div>
      </div>
    </div>
  );
};

export default Blog;