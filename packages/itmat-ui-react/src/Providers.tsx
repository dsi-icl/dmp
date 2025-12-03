import { FunctionComponent, PropsWithChildren, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import { trpc } from './utils/trpc';
import { AuthProvider } from './utils/dmpWebauthn/webauthn.context';

const Providers: FunctionComponent<PropsWithChildren<unknown>> = ({ children }) => {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false
            }
        }
    }));
    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpLink({
                    url: `${window.location.origin}/trpc`,
                    async headers() {
                        return {
                            authorization: document.cookie
                        };
                    }
                })
            ]
        })
    );

    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <HelmetProvider>
                    <Router basename={process.env.NX_REACT_APP_BASEHREF}>
                        <AuthProvider>
                            {children}
                        </AuthProvider>
                    </Router>
                </HelmetProvider>
            </QueryClientProvider>
        </trpc.Provider>
    );
};

export default Providers;
