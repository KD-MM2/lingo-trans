import { Fragment, useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { AppSidebar, sidebarData } from '@src/components/app-sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@src/components/ui/breadcrumb';
import { Separator } from '@src/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@src/components/ui/sidebar';
import { ThemeProvider } from '@src/providers/theme';
import { ModeToggle } from './mode-toggle';

type BreadcrumbEntry = {
    to: string;
    label: string;
    navigable: boolean;
};

type BreadcrumbMeta = {
    title: string;
    navigable: boolean;
};

const breadcrumbLookup = new Map<string, BreadcrumbMeta>();

sidebarData.navMain.forEach((section) => {
    if (section.url) {
        breadcrumbLookup.set(section.url, { title: section.title, navigable: false });
    }
    section.items.forEach((item) => {
        breadcrumbLookup.set(item.url || '/', { title: item.title, navigable: true });
    });
});

const formatSegment = (segment: string) =>
    segment
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

function buildBreadcrumbs(pathname: string): BreadcrumbEntry[] {
    const cleanPath = pathname.split('?')[0]?.split('#')[0] ?? '/';

    if (cleanPath === '/' || cleanPath === '') {
        const home = breadcrumbLookup.get('/')?.title ?? 'Home';
        return [{ to: '/', label: home, navigable: false }];
    }

    const segments = cleanPath.split('/').filter(Boolean);
    return segments.map((segment, index) => {
        const to = `/${segments.slice(0, index + 1).join('/')}`;
        const lookup = breadcrumbLookup.get(to);
        const label = lookup?.title ?? formatSegment(segment);
        return {
            to,
            label: label || '…',
            navigable: lookup?.navigable ?? false
        };
    });
}

export default function RootLayout() {
    const location = useLocation();

    const breadcrumbs = useMemo(() => buildBreadcrumbs(location.pathname), [location.pathname]);

    return (
        <ThemeProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                {breadcrumbs.map((crumb, index) => {
                                    const isLast = index === breadcrumbs.length - 1;
                                    const hideOnMobile = breadcrumbs.length > 1 && index === 0;
                                    const shouldLink = !isLast && crumb.navigable;

                                    return (
                                        <Fragment key={crumb.to}>
                                            <BreadcrumbItem className={hideOnMobile ? 'hidden md:block' : undefined}>
                                                {isLast || !shouldLink ? (
                                                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink asChild>
                                                        <Link to={crumb.to} aria-current={isLast ? 'page' : undefined}>
                                                            {crumb.label}
                                                        </Link>
                                                    </BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                            {!isLast ? <BreadcrumbSeparator className={hideOnMobile ? 'hidden md:block' : undefined} /> : null}
                                        </Fragment>
                                    );
                                })}
                            </BreadcrumbList>
                        </Breadcrumb>
                        <div className="ml-auto">
                            <ModeToggle />
                        </div>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4">
                        <Outlet />
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </ThemeProvider>
    );
}
