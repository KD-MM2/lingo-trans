import * as React from 'react';
import { Check, ChevronsUpDown, GalleryVerticalEnd } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@src/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@src/components/ui/sidebar';
import { Separator } from './ui/separator';
import { useSettings } from '@src/hooks/use-settings';
import type { ModelProvider } from '@src/types/settings';

export type ServerOption = {
    label: string;
    value: ModelProvider;
};

export function ServerSwitcher({ servers, defaultServer }: { servers: ServerOption[]; defaultServer: ModelProvider }) {
    const { settings, hydrated, saveSettings } = useSettings();

    const [selectedProvider, setSelectedProvider] = React.useState<ModelProvider>(() => {
        const fallback = servers[0]?.value ?? defaultServer;
        return servers.some((option) => option.value === defaultServer) ? defaultServer : fallback;
    });

    React.useEffect(() => {
        if (!hydrated) return;

        const fallback = servers[0]?.value ?? defaultServer;
        const next = servers.some((option) => option.value === settings.modelProvider) ? settings.modelProvider : fallback;
        setSelectedProvider(next);
    }, [hydrated, settings.modelProvider, servers, defaultServer]);

    const selectedOption = servers.find((option) => option.value === selectedProvider) ?? servers[0];
    const hasServers = servers.length > 0;
    const displayLabel = hasServers ? (selectedOption?.label ?? 'Unknown') : 'No servers';

    const handleSelect = (provider: ModelProvider) => {
        if (!hasServers) return;
        if (provider === selectedProvider) return;
        setSelectedProvider(provider);
        saveSettings((current) => {
            if (current.modelProvider === provider) return current;
            return { ...current, modelProvider: provider };
        });
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                <GalleryVerticalEnd className="size-4" />
                            </div>
                            <div className="flex flex-col gap-0.5 leading-none">
                                <span className="font-medium">Servers</span>
                                <span className="">{displayLabel}</span>
                            </div>
                            {hasServers && <ChevronsUpDown className="ml-auto" />}
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)" align="start">
                        {servers.map((server) => {
                            const isActive = server.value === selectedProvider;
                            return (
                                <DropdownMenuItem key={server.value} onSelect={() => handleSelect(server.value)}>
                                    {server.label} {isActive && <Check className="ml-auto" />}
                                </DropdownMenuItem>
                            );
                        })}
                        <Separator className="my-1" />
                        <DropdownMenuItem key="add-new-server" onSelect={() => alert('Add new server')}>
                            Add new server
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
