import { Alert, Platform } from 'react-native';

// En la web, Alert de React Native no muestra nada: ahí usamos los avisos del navegador.
export function notify(title: string, message = '', onClose?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    onClose?.();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onClose }]);
}

export function confirmAction(title: string, message: string, onOk: () => void, okText = 'Confirmar') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: okText, style: 'destructive', onPress: onOk },
  ]);
}
