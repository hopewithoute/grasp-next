const react = require('react');
// Mock useState, useRef, etc.
react.useState = (init) => [init, () => {}];
react.useRef = () => ({ current: { id: 'test' } });
react.useEffect = () => {};
react.useCallback = (cb) => cb;
react.useMemo = (cb) => cb();

const { useChat } = require('@ai-sdk/react');
const result = useChat({ api: '/api/chat' });
console.log(Object.keys(result));
