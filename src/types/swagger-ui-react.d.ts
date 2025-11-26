declare module 'swagger-ui-react' {
  import { Component } from 'react';

  interface SwaggerUIProps {
    url?: string;
    spec?: object;
    docExpansion?: 'list' | 'full' | 'none';
    defaultModelsExpandDepth?: number;
    defaultModelExpandDepth?: number;
    displayOperationId?: boolean;
    displayRequestDuration?: boolean;
    filter?: boolean | string;
    maxDisplayedTags?: number;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    supportedSubmitMethods?: Array<'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'>;
    tryItOutEnabled?: boolean;
    requestInterceptor?: (request: Request) => Request;
    responseInterceptor?: (response: Response) => Response;
    onComplete?: () => void;
    presets?: any[];
    plugins?: any[];
    layout?: string;
    deepLinking?: boolean;
    showMutatedRequest?: boolean;
    persistAuthorization?: boolean;
  }

  export default class SwaggerUI extends Component<SwaggerUIProps> {}
}
