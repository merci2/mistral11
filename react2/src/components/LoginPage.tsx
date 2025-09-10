import { useAuth } from '../config/useAuth';

const LoginPage = () => {
  const { login, loading } = useAuth();

  const handleLogin = async () => {
    await login();
  };

  // App-Konfiguration direkt hier definieren oder aus einer separaten Datei importieren
  const appConfig = {
    appName: 'Your App Name',
    environment: import.meta.env.MODE,
    isDevelopment: import.meta.env.DEV
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-content">
          <h1>Welcome to {appConfig.appName}</h1>
          <p>Please sign in with your Microsoft account to continue</p>
          {appConfig.isDevelopment && (
            <div className="dev-info">
              <small>Environment: {appConfig.environment}</small>
            </div>
          )}
          <button 
            className="login-button" 
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Login with Microsoft'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;