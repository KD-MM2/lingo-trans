import * as React from 'react';
import { Check, ChevronsUpDown, GalleryVerticalEnd } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@src/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@src/components/ui/sidebar';
// import { Separator } from './ui/separator';
import { useSettings } from '@src/hooks/use-settings';
import type { ModelProvider } from '@src/types/settings';

export type ProviderOption = {
    label: string;
    value: ModelProvider;
};

export function ProviderSwitcher({ providers, defaultProvider }: { providers: ProviderOption[]; defaultProvider: ModelProvider }) {
    const { settings, hydrated, saveSettings } = useSettings();

    const [selectedProvider, setSelectedProvider] = React.useState<ModelProvider>(() => {
        const fallback = providers[0]?.value ?? defaultProvider;
        return providers.some((option) => option.value === defaultProvider) ? defaultProvider : fallback;
    });

    React.useEffect(() => {
        if (!hydrated) return;

        const fallback = providers[0]?.value ?? defaultProvider;
        const next = providers.some((option) => option.value === settings.modelProvider) ? settings.modelProvider : fallback;
        setSelectedProvider(next);
    }, [hydrated, settings.modelProvider, providers, defaultProvider]);

    const selectedOption = providers.find((option) => option.value === selectedProvider) ?? providers[0];
    const hasProviders = providers.length > 0;
    const displayLabel = hasProviders ? (selectedOption?.label ?? 'Unknown') : 'No providers';

    const handleSelect = (provider: ModelProvider) => {
        if (!hasProviders) return;
        if (provider === selectedProvider) return;

        setSelectedProvider(provider);

        saveSettings((current) => {
            if (current.modelProvider === provider) {
                return current;
            }

            return {
                ...current,
                modelProvider: provider,
                model: ''
            };
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
                                <span className="font-medium">Providers</span>
                                <span className="">{displayLabel}</span>
                            </div>
                            {hasProviders && <ChevronsUpDown className="ml-auto" />}
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)" align="start">
                        {providers.map((provider) => {
                            const isActive = provider.value === selectedProvider;
                            return (
                                <DropdownMenuItem key={provider.value} onSelect={() => handleSelect(provider.value)}>
                                    {provider.label} {isActive && <Check className="ml-auto" />}
                                </DropdownMenuItem>
                            );
                        })}
                        {/* <Separator className="my-1" />
                        <DropdownMenuItem key="add-new-server" onSelect={() => alert('Add new server')}>
                            Add new server
                        </DropdownMenuItem> */}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
