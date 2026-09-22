export const extractKeysFromPayload = (eventData, prefix = "msg.payload") => {
  let keys = [];
  
  if (eventData === null || eventData === undefined) {
    return keys;
  }

  let payload = eventData;
  // Unwrap the actual msg.payload if available
  if (eventData.msg && eventData.msg.payload !== undefined) {
    payload = eventData.msg.payload;
  } else if (eventData.type === 'rate_limit_state' && eventData.msg) {
    payload = eventData.msg.payload !== undefined ? eventData.msg.payload : eventData.msg;
  }

  const type = typeof payload;
  
  // Primitives
  if (type !== 'object') {
    keys.push({ path: prefix, type: type });
    return keys;
  }
  
  // Arrays
  if (Array.isArray(payload)) {
    keys.push({ path: prefix, type: 'array' });
    keys.push({ path: `${prefix}.length`, type: 'number' });
    
    // Sample the first item to get inner fields (using index 0 for demonstration)
    if (payload.length > 0) {
      const firstItem = payload[0];
      if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
        const subKeys = extractKeysFromPayload(firstItem, `${prefix}[0]`);
        keys = keys.concat(subKeys);
      }
    }
    
    return keys;
  }
  
  // Objects
  keys.push({ path: prefix, type: 'object' });
  
  for (const key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = payload[key];
      const nextPrefix = `${prefix}.${key}`;
      
      const subKeys = extractKeysFromPayload(value, nextPrefix);
      keys = keys.concat(subKeys);
    }
  }
  
  return keys;
};

/**
 * Format a path and type into a label for the dropdown.
 * 
 * @param {string} path 
 * @param {string} type 
 * @returns {string}
 */
export const formatPathLabel = (path, type) => {
  const typeStr = type.charAt(0).toUpperCase() + type.slice(1);
  return `${path} (${typeStr})`;
};

/**
 * Resolves a dot-notation path against the payload.
 * Note: The payload here is usually the raw debugData websocket event.
 * Because extractKeysFromPayload maps the root of debugData to "msg.payload",
 * we strip "msg.payload" from the path before traversing.
 * 
 * @param {any} payload The root payload object
 * @param {string} path The path to resolve (e.g. "msg.payload.counts.person")
 * @returns {any} The resolved value
 */
export const getValueByPath = (eventData, path) => {
  if (eventData === null || eventData === undefined || !path) return undefined;

  let payload = eventData;
  // Unwrap the actual msg.payload if available
  if (eventData.msg && eventData.msg.payload !== undefined) {
    payload = eventData.msg.payload;
  } else if (eventData.type === 'rate_limit_state' && eventData.msg) {
    payload = eventData.msg.payload !== undefined ? eventData.msg.payload : eventData.msg;
  }

  // If path is exactly the root, return the whole object
  if (path === 'msg.payload') {
    return payload;
  }

  let cleanPath = path;
  if (cleanPath.startsWith('msg.payload.')) {
    cleanPath = cleanPath.substring(12); // length of 'msg.payload.'
  } else if (cleanPath.startsWith('msg.payload[')) {
    cleanPath = cleanPath.substring(11); // length of 'msg.payload'
  } else {
    // If it doesn't start with msg.payload but we expect it to, we might just try resolving it directly
    // This handles cases like 'alerts' if they are somehow added
  }

  // Basic dot notation parser handling arrays like `[0]`
  // e.g. "detections[0].label" -> ["detections", "0", "label"]
  const parts = cleanPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);

  let current = payload;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // length property of arrays
    if (Array.isArray(current) && part === 'length') {
      current = current.length;
    } else {
      current = current[part];
    }
  }

  return current;
};
