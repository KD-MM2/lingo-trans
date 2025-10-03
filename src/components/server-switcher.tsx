import * as React from 'react';
import { Check, ChevronsUpDown, GalleryVerticalEnd } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Separator } from './ui/separator';

export function ServerSwitcher({ servers, defaultServer }: { servers: string[]; defaultServer: string }) {
    const [selectedServer, setSelectedServer] = React.useState(defaultServer);

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
                                <span className="">{selectedServer}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)" align="start">
                        {servers.map((server) => (
                            <DropdownMenuItem key={server} onSelect={() => setSelectedServer(server)}>
                                {server} {server === selectedServer && <Check className="ml-auto" />}
                            </DropdownMenuItem>
                        ))}
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
