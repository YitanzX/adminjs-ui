import type { NavigationElementWithChildrenProps } from '@adminjs/design-system';

/**
 * Sidebar entries for the library's pages, so a host that overrides
 * `SidebarResourceSection` can surface them:
 *
 *   const links = adminJsUiNavLinks({ currentAdmin, location, navigate });
 *   <Navigation elements={[...yourElements, ...links]} />
 *
 * Gated by role: Settings → super admins, Media Library → any admin.
 */
export interface NavLinkContext {
  currentAdmin: { isAdmin?: boolean; isSuperAdmin?: boolean } | null | undefined;
  location: { pathname: string };
  navigate: (href: string) => void;
  rootPath?: string;
  pages?: { settings?: string | false; media?: string | false };
}

export const adminJsUiNavLinks = ({
  currentAdmin,
  location,
  navigate,
  rootPath = '/admin',
  pages,
}: NavLinkContext): NavigationElementWithChildrenProps[] => {
  const settingsKey = pages?.settings ?? 'settings';
  const mediaKey = pages?.media ?? 'media';
  const isSuperAdmin = !!currentAdmin?.isSuperAdmin;
  const isAdmin = isSuperAdmin || !!currentAdmin?.isAdmin;

  const link = (key: string, label: string, icon: string): NavigationElementWithChildrenProps => {
    const href = `${rootPath}/pages/${key}`;
    return {
      id: `adminjs-ui-${key}`,
      label,
      icon,
      href,
      isSelected: new RegExp(`/pages/${key}($|/)`).test(location.pathname),
      onClick: (event): void => {
        event.preventDefault();
        navigate(href);
      },
    };
  };

  const out: NavigationElementWithChildrenProps[] = [];
  if (mediaKey && isAdmin) out.push(link(mediaKey, 'Media Library', 'Image'));
  if (settingsKey && isSuperAdmin) out.push(link(settingsKey, 'Settings', 'Settings'));
  return out;
};
