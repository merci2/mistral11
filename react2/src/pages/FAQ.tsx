// src/pages/FAQ.tsx
const FAQ = () => {
  return (
    <div className="page">
      <div className="container">
        <h1>Frequently Asked Questions</h1>
        <div className="faq-list">
          <div className="faq-item">
            <h3>How do I get started?</h3>
            <p>Simply contact us through our contact form or give us a call.</p>
          </div>
          <div className="faq-item">
            <h3>What technologies do you use?</h3>
            <p>We use modern technologies like React, Node.js, and cloud services.</p>
          </div>
          <div className="faq-item">
            <h3>Do you offer support?</h3>
            <p>Yes, we provide 24/7 support for all our clients.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;