declare module 'react-native-view-shot' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  interface CaptureOptions {
    format?: 'png' | 'jpg' | 'webm';
    quality?: number;
    result?: 'tmpfile' | 'base64' | 'data-uri' | 'zip-base64';
    width?: number;
    height?: number;
    snapshotContentContainer?: boolean;
  }

  interface ViewShotProperties extends ViewProps {
    options?: CaptureOptions;
    captureMode?: 'mount' | 'continuous' | 'update' | 'none';
    onCapture?: (uri: string) => void;
    onCaptureFailure?: (error: Error) => void;
  }

  export default class ViewShot extends Component<ViewShotProperties> {
    capture(): Promise<string>;
  }
}
