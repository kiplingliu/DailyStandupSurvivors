import { App } from 'antd';

const useAppNotification = () => {
  const { notification } = App.useApp();

  const showSuccess = (message, description) => {
    notification.success({
      message,
      description,
      placement: 'top',
    });
  };

  const showError = (message, description) => {
    notification.error({
      message,
      description,
      placement: 'top',
    });
  };

  const showInfo = (message, description) => {
    notification.info({
      message,
      description,
      placement: 'top',
    });
  };

  const showWarning = (message, description) => {
    notification.warning({
      message,
      description,
      placement: 'top',
    });
  };

  const showLoading = (key, message = 'Loading...') => {
    notification.open({
      key,
      message,
      description: 'Please wait...',
      duration: 0,
      placement: 'top',
    });
  };

  const updateNotification = (key, type, message, description) => {
    notification[type]({
      key,
      message,
      description,
      placement: 'top',
    });
  };

  const handleAsync = async (asyncFunc, loadingMessage, successMessage, errorMessage) => {
    const key = `async-${Date.now()}`;
    showLoading(key, loadingMessage);
    try {
      const result = await asyncFunc();
      updateNotification(key, 'success', successMessage, 'The operation completed successfully.');
      return result;
    } catch (error) {
      updateNotification(key, 'error', errorMessage, error.message || 'An unexpected error occurred.');
      throw error;
    }
  };

  return {
    success: showSuccess,
    error: showError,
    info: showInfo,
    warning: showWarning,
    loading: showLoading,
    update: updateNotification,
    async: handleAsync,
  };
};

export default useAppNotification;