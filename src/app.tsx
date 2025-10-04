import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import RootLayout from './components/root-layout';
import About from './pages/about';
import Rewriting from './pages/rewriting';
import Settings from './pages/settings';
import Templates from './pages/templates';
import Translation from './pages/translation';

const routes = [
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
];

const inferredBasename = (): string => {
    if (typeof window === 'undefined') {
        return '/';
    }

    const { pathname } = window.location;
    return pathname.endsWith('.html') ? pathname : '/';
};

const router = createBrowserRouter(routes, { basename: inferredBasename() });

const App = () => {
    return <RouterProvider router={router} />;
};

export default App;
