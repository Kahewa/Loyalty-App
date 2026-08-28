import { Alert, Platform } from 'react-native';

/**
 * react-native-web ships `Alert.alert` as an empty function — literally
 * `static alert() {}`. Every confirm in the app would look wired up and do
 * nothing, which is worse than not having the web build at all.
 *
 * Same call signature as Alert.alert, so it is a drop-in.
 */
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    return Alert.alert(title, message, buttons);
  }

  const text = [title, message].filter(Boolean).join('\n\n');
  const actions = (buttons || []).filter((b) => b.style !== 'cancel' && b.onPress);

  if (actions.length === 0) {
    window.alert(text);
    buttons?.find((b) => b.style !== 'cancel')?.onPress?.();
    return;
  }

  // The browser gives us one yes/no box. With more than one real choice, offer
  // them in order and stop at the first accepted — clunkier than a native sheet,
  // but every option stays reachable.
  for (const action of actions) {
    const prompt = actions.length === 1 ? text : `${text}\n\n${action.text}?`;
    if (window.confirm(prompt)) {
      action.onPress();
      return;
    }
  }
}
