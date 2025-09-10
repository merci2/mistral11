import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig';

export const useAuth = () => {
    const { instance, accounts, inProgress } = useMsal();
    
    const isAuthenticated = accounts.length > 0;
    const account = accounts[0] || null;
    const loading = inProgress === InteractionStatus.Login || 
                   inProgress === InteractionStatus.SsoSilent ||
                   inProgress === InteractionStatus.Startup;

    const login = async (): Promise<void> => {
        try {
            await instance.loginPopup(loginRequest);
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    const logout = (): void => {
        instance.logoutPopup().catch((error) => {
            console.error('Logout failed:', error);
        });
    };

    return {
        isAuthenticated,
        account,
        login,
        logout,
        loading
    };
};