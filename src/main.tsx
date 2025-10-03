import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import RootLayout from './components/root-layout';
import Translation from './pages/translation';
import About from './pages/about';
import Rewriting from './pages/rewriting';
import Settings from './pages/settings';
import Templates from './pages/templates';

const router = createBrowserRouter([
    {
        path: '/',
        Component: RootLayout,
        children: [
            { path: '/', Component: Translation, index: true },
            { path: 'rewriting', Component: Rewriting },
            {
                path: 'others',
                children: [
                    { path: 'templates', Component: Templates },
                    { path: 'about', Component: About },
                    { path: 'settings', Component: Settings }
                ]
            }
        ]
    }
]);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
