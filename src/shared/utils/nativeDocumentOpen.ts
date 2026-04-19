const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-');

const buildDocumentDestination = async (
  fileName: string,
  fileSystem: typeof import('expo-file-system/legacy')
) => {
  const baseDirectory = fileSystem.documentDirectory ?? fileSystem.cacheDirectory;
  if (!baseDirectory) {
    return null;
  }

  const directory = `${baseDirectory}downloads/`;
  await fileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const safeFileName = sanitizeFileName(fileName) || `document-${Date.now()}`;
  return `${directory}${Date.now()}-${safeFileName}`;
};

export const downloadRemoteDocument = async ({
  url,
  fileName,
}: {
  url: string;
  fileName: string;
}) => {
  const FileSystem = await import('expo-file-system/legacy');

  const destination = await buildDocumentDestination(fileName, FileSystem);
  if (!destination) {
    throw new Error('No local directory is available for document downloads.');
  }

  const downloadResult = await FileSystem.downloadAsync(url, destination);
  if (downloadResult.status < 200 || downloadResult.status >= 300) {
    throw new Error('Could not download the document.');
  }

  return {
    uri: downloadResult.uri,
    relativePath:
      FileSystem.documentDirectory && downloadResult.uri.startsWith(FileSystem.documentDirectory)
        ? downloadResult.uri.replace(FileSystem.documentDirectory, 'Files/')
        : downloadResult.uri,
  };
};
