import { App } from 'antd';

const useAppNotification = () => {
  const { message: messageApi } = App.useApp();

  const showSuccess = (message, description) => {
    messageApi.success(description ? `${message}: ${description}` : message);
  };

  const showError = (message, description) => {
    messageApi.error(description ? `${message}: ${description}` : message);
  };

  const showInfo = (message, description) => {
    messageApi.info(description ? `${message}: ${description}` : message);
  };

  const showWarning = (message, description) => {
    messageApi.warning(description ? `${message}: ${description}` : message);
  };

  const showLoading = (key, message = 'Loading...') => {
    messageApi.loading({ content: message, key, duration: 0 });
  };

  const updateNotification = (key, type, message, description) => {
    messageApi[type]({
      content: description ? `${message}: ${description}` : message,
      key,
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