declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*?raw' {
  const value: string;
  export default value;
}
