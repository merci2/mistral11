import { type Configuration, LogLevel } from '@azure/msal-browser';

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */
export const msalConfig: Configuration = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '', // Azure AD Application (client) ID
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`, // Single tenant
        redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin // Redirect URI
    },
    cache: {
        cacheLocation: 'sessionStorage', // This configures where your cache will be stored
        storeAuthStateInCookie: false // Set to true for IE 11 or Edge
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }
            }
        }
    }
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 */
export const loginRequest = {
    scopes: ['User.Read']
};

/**
 * Application configuration
 */
export const appConfig = {
    appName: import.meta.env.VITE_APP_NAME || 'Microsoft Auth App',
    environment: import.meta.env.MODE,
    isDevelopment: import.meta.env.DEV
};

// Validation: Check if required environment variables are set
if (!import.meta.env.VITE_AZURE_CLIENT_ID) {
    console.error('VITE_AZURE_CLIENT_ID is not set in environment variables');
}

if (!import.meta.env.VITE_AZURE_TENANT_ID) {
    console.error('VITE_AZURE_TENANT_ID is not set in environment variables');
}