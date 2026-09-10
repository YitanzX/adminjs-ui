import { AdminUiSetting } from './settings/entity.js';
import { MediaItem } from './media/entity.js';

/**
 * TypeORM entity classes the library owns. Spread this into your DataSource
 * `entities` array — the library controls the contents, and `applyOptions`
 * keeps them out of the AdminJS resource list automatically.
 *
 *   entities: [...myEntities, ...ADMINJS_UI_ENTITIES]
 */
export const ADMINJS_UI_ENTITIES = [AdminUiSetting, MediaItem] as const;

export { AdminUiSetting, MediaItem };
