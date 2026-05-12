export enum BooleanSetting {
  YES = "yes",
  NO = "no"
}

export enum SizeSetting {
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export enum LayoutSetting {
  ROWS = "rows",
  COLUMNS = "columns",
}

export enum ThemeSetting {
  DEFAULT = "default",
  BRUTALIST = "brutalist",
  IOS = "ios",
  WIN98 = "win98",
}

export type SettingsProps = {
  firstRun: boolean,
  rootFolderName: string,
  bookmarksShowFolderName: BooleanSetting,
  layout: LayoutSetting,
  bookmarksWidth: string,
  bookmarkItemIcon: BooleanSetting,
  bookmarkItemSize: SizeSetting,
  bookmarksShowSubfolders: BooleanSetting,
  bookmarksReordering: BooleanSetting,
  bookmarksSearchBar: BooleanSetting,
  showTopBookmarks: BooleanSetting,
  showLastBookmarks: BooleanSetting,
  theme: ThemeSetting
  // [key: string]: boolean | string | BooleanSetting
}

type SettingsWithBooleanValue = Pick<SettingsProps, "bookmarkItemIcon" | "bookmarksShowSubfolders" | "bookmarksReordering" | "bookmarksSearchBar" | "showTopBookmarks" | "showLastBookmarks">;


/**
 * Settings manager (LocalStorage).
 */
export class Settings {
  static SETTINGS_ROOT_KEY = "newtab-bookmarks";
  public settings: SettingsProps = Object.create(null);

  constructor() {
    this.settings = {
      firstRun: true,
      rootFolderName: '',
      bookmarksShowFolderName: BooleanSetting.NO,
      layout: LayoutSetting.ROWS,
      bookmarksWidth: 'full-screen',
      bookmarkItemIcon: BooleanSetting.YES,
      bookmarkItemSize: SizeSetting.SMALL,
      bookmarksShowSubfolders: BooleanSetting.NO,
      bookmarksReordering: BooleanSetting.YES,
      bookmarksSearchBar: BooleanSetting.YES,
      showTopBookmarks: BooleanSetting.NO,
      showLastBookmarks: BooleanSetting.NO,
      theme: ThemeSetting.DEFAULT
    };
  }

  /**
   * Initialize the Local Storage key to keep the settings object.
   */
  async init() {
    const settings = await chrome.storage.local.get(Settings.SETTINGS_ROOT_KEY) || Object.create(null);
    this.settings = {...this.settings, ...settings[Settings.SETTINGS_ROOT_KEY]};
    return this;
  }

  isOn(settingName: string) {
    return this.settings[settingName as keyof SettingsWithBooleanValue] === BooleanSetting.YES;
  }

  isOff(settingName: string) {
    const settingValue = this.settings[settingName as keyof SettingsWithBooleanValue];
    return !settingValue || settingValue === BooleanSetting.NO;
  }

  getValue<K extends keyof SettingsProps>(settingName: K): SettingsProps[K] {
    return this.settings[settingName];
  }

  setValue<K extends keyof SettingsProps, T extends SettingsProps[K]>(settingName: K, settingValue: T) {
    this.settings[settingName] = settingValue;
  }

  async saveOne<K extends keyof SettingsProps, T extends SettingsProps[K]>(key: K, value: T) {
    this.setValue(key, value);
    await this.save();
  }

  getAll() {
    return this.settings;
  }

  async save(newSettings?: Partial<SettingsProps>) {
    const settingsToSave = newSettings
        ? {...this.settings, ...newSettings, firstRun: false}
        : {...this.settings, firstRun: false};
    await chrome.storage.local.set({[Settings.SETTINGS_ROOT_KEY]: settingsToSave});
    this.settings = settingsToSave;
  }
}
