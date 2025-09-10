const Home = () => {
  const handleGetStarted = () => {
    // Event senden, um Chatbot zu öffnen
    window.dispatchEvent(new CustomEvent('openChatbot'));
  };

  return (
    <div className="page">
      <div className="container">
        <section className="hero">
          <h1>RAG 1</h1>
          <p>AI Chatbot: chat about our website content & and with your uploaded documents.</p>
          <button className="cta-button" onClick={handleGetStarted}>Get Started</button>
        </section>
        
        <section className="features">
          <h2>Why Choose Us</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>Quality</h3>
              <p>High-quality solutions tailored to your needs.</p>
            </div>
            <div className="feature-card">
              <h3>Speed</h3>
              <p>Fast delivery and quick response times.</p>
            </div>
            <div className="feature-card">
              <h3>Support</h3>
              <p>24/7 customer support and assistance.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;