import { MenuItem, getLatestWheelPick } from './models';

export function getVisibleWheelPick(isSpinning: boolean, menu: MenuItem[], lastWheelPickId: string | null) {
  return isSpinning ? undefined : getLatestWheelPick(menu, lastWheelPickId);
}
