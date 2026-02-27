import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LanguageContext } from '@shared/context/LanguageContext';
import { captureAppException } from '@lib/monitoring';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  static contextType = LanguageContext;

  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled render error in app boundary', error, errorInfo);
    captureAppException(error, {
      componentStack: errorInfo.componentStack,
      source: 'AppErrorBoundary',
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    const t = (this.context as React.ContextType<typeof LanguageContext> | undefined)?.t;
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>{t ? t('appErrorTitle') : 'Something went wrong'}</Text>
            <Text style={styles.body}>
              {t
                ? t('appErrorBody')
                : 'The app caught an unexpected error. Please retry. If this keeps happening, restart the app.'}
            </Text>
            <Pressable style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonLabel}>{t ? t('retry') : 'Retry'}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
    padding: 20,
  },
  title: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
