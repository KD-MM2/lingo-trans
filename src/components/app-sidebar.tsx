import * as React from 'react';
import { Link, useLocation } from 'react-router';

// import { SearchForm } from '@src/components/search-form';
import { ServerSwitcher, type ServerOption } from '@src/components/server-switcher';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@src/components/ui/sidebar';
import type { ModelProvider } from '@src/types/settings';

// This is sample data.
export type NavSection = {
    title: string;
    url?: string;
    items: Array<{
        title: string;
        url: string;
    }>;
};

const serverOptions: Record<ModelProvider, ServerOption> = {
    openai: { label: 'OpenAI', value: 'openai' },
    claude: { label: 'Claude', value: 'claude' },
    'self-hosted': { label: 'Self-hosted', value: 'self-hosted' }
};

export const sidebarData: { servers: ServerOption[]; navMain: NavSection[] } = {
    servers: [serverOptions.openai, serverOptions.claude, serverOptions['self-hosted']],
    navMain: [
        {
            title: 'Tools',
            items: [
                {
                    title: 'Translation',
                    url: '/'
                },
                {
                    title: 'Rewriting',
                    url: '/rewriting'
                }
            ]
        },
        {
            title: 'Others',
            items: [
                {
                    title: 'Templates',
                    url: '/others/templates'
                },
                {
                    title: 'Settings',
                    url: '/others/settings'
                },
                {
                    title: 'About',
                    url: '/others/about'
                }
            ]
        }
    ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const location = useLocation();

    const isActive = React.useCallback(
        (itemUrl: string) => {
            if (itemUrl === '/') {
                return location.pathname === '/';
            }

            return location.pathname === itemUrl || location.pathname.startsWith(`${itemUrl}/`);
        },
        [location.pathname]
    );

    return (
        <Sidebar {...props}>
            <SidebarHeader>
                <ServerSwitcher servers={sidebarData.servers} defaultServer={serverOptions.openai.value} />
                {/* <SearchForm /> */}
            </SidebarHeader>
            <SidebarContent>
                {/* We create a SidebarGroup for each parent. */}
                {sidebarData.navMain.map((item) => (
                    <SidebarGroup key={item.title}>
                        <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {item.items.map((navItem) => (
                                    <SidebarMenuItem key={navItem.title}>
                                        <SidebarMenuButton asChild isActive={isActive(navItem.url)}>
                                            <Link to={navItem.url} aria-current={isActive(navItem.url) ? 'page' : undefined}>
                                                {navItem.title}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    );
}
