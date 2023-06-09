import { buildId, isEmptyObject } from '../../../src/utils';
import { 
  isMeta,
  siftOutLabelAndFetch 
} from './utils';

const validate = function() {
  const applyFormat = (value, formats) => {
    const { lowercase, uppercase } = formats;

    return lowercase && value.toLowerCase
    ? value.toLowerCase()
    : uppercase && value.toUpperCase
    ? value.toUpperCase()
    : value;
  }

  const applyFormatting = (data, key) => {
    const { schema, validKey } = data;

    data.validKey = applyFormat(validKey, schema[key]);
  }

  const applyGlobalFormatting = async (data, globalFormatting) => {
    const { key, validKey } = data;
    let formatted;

    if(typeof globalFormatting === 'object') {
      formatted = applyFormat(validKey, globalFormatting);
    } else {
      formatted = await globalFormatting(validKey);
    }

    if(!formatted && typeof formatted !== 'boolean') {
      console.error(`Failed to format key '${key}' with global formatting for ${data.collectionName}`);
    }

    data.validKey = formatted || validKey;
  }

  const applyMetaMethod = async (data, key) => {
    const { 
      metadata, 
      setValue,
      metaValue, 
      validated, 
      body,
      req
    } = data;

    try {
      const validMeta = await metaValue(validated || body, req);

      metadata[key] = setValue(validMeta);
    } catch(error) {
      err(`Failed to validate meta '${key}': ${body[key]} ↓↓↓
      ${error.message}`);
    }
  }

  const assignBodyKeyToValidated = (data, key) => {
    const { validated, body } = data;
    return validated[key] = body[key];
  }

  const assignDefaultProp = (data, key) => {
    const { validated, schema } = data;
    validated[key] = schema[key].default;
  }

  const assignMetaToData = (data, key) => {
    const { collectionName, metadata } = data;
    const meta = metadata[key];
    const readable = meta.name || meta;

    Object.assign(data, {
      meta,
      readable,
      metaValue: meta.value || meta,
      setValue: value => `${collectionName}:${readable}_${value}`
    });
  }

  const assignMetaReference = (data, key) => {
    const { metadata, validated, readable, meta, setValue } = data;
    const metaRef = validated.hasOwnProperty(readable)
      ? validated[readable]
      : meta;

    metadata[key] = setValue(metaRef);
  }

  const assignMetaValue = (data, key) => {
    const { metadata, setValue, metaValue } = data;
    metadata[key] = setValue(metaValue);
  }

  const bookmarkMetaForLater = (data, key) => {
    const { metadata, schema } = data;
    metadata[key] = schema[key];
  }

  const buildSchemaId = (collectionName) => collectionName 
  ? `${collectionName}:${buildId()}` 
  : undefined;

  const concatMetaRefs = (data, key) => {
    const { metadata, validated, setValue } = data;
    const concatArray = metadata[key].concat;
    let concatedRefs = '';

    concatArray.forEach(ref => {
      concatedRefs += validated[ref];
    });

    metadata[key] = setValue(concatedRefs);
  }

  const err = (message) => {
    throw new Error(message);
  }

  const getValidatedValue = async (data, key) => {
    const {
      body, 
      validated,
      req,
      schemaKeyType
    } = data;

    const parameters = {
      value: body[key],
      item: body,
      validated,
      req: req 
    }

    return await schemaKeyType(body[key], parameters);
  }

  const hasDefault = (data, key) => {
    const { schema } = data;

    return (schema[key]).hasOwnProperty('default');
  }

  const hasFormatting = (data, key) => {
    const { schema } = data;

    if(typeof schema[key] !== 'object' || Array.isArray(schema[key])) {
      return;
    }

    const formats = ['lowercase', 'uppercase'];

    return formats.some(format => schema[key].hasOwnProperty(format));
  };

  const isAConcat = (data, key) => {
    const { metadata } = data;
    return metadata[key].hasOwnProperty('concat');
  }

  const isADuplicate = async (data, key) => {
    const { schema, body, collectionName } = data;
    const query = { [key]: body[key] };

    const { 
      key: duplicateKey,
      items
    } = await siftOutLabelAndFetch(schema, query, collectionName) || {};

    const dupKey = duplicateKey
      ? duplicateKey
      : items 
      ? items[0].key 
      : null;

    return body._id !== dupKey && (dupKey || items);
  }
  

  const isFunction = ({ metaValue }) => typeof metaValue === 'function';

  const isReferenceToBody = ({ readable, metaValue }) => {
    return typeof readable === 'string' && typeof metaValue === 'string';
  }

  const isType = ({ schemaKeyType }) => ({
    array: Array.isArray(schemaKeyType),
    object: typeof schemaKeyType === 'object'
  })

  const isUnique = ({ unique }) => !!unique;

  const isWild = (symbol) => symbol === '*';

  const validateItemsInArray = async (data, key) => {
    const { collectionName, validated, body, schemaKeyType, req, globalFormatting } = data;
    const nested = schemaKeyType[0] || {};
        
    validated[key] = body[key]
    ? await Promise.all(
        body[key].map(async (itm) => {
          return (await validate.init(
            collectionName,
            nested,
            itm,
            body,
            req,
            globalFormatting
          )).validated;
        })
      )
    : await Promise.all(
        schemaKeyType.map(async (_) => {
          return (await validate.init(
            collectionName,
            nested,
            undefined,
            body,
            req,
            globalFormatting
          )).validated;
        })
      );
  
  }

  const validateSubObject = async (data, key) => {
    const { collectionName, schema, body, validated } = data;
    validated[key] = await validate.init(collectionName, schema[key], body[key]).validated;
  }

  const validateSingleItem = (body, schema) => {
    return !body ? body : schema(body);
  }

  return {
    init: async (collectionName, schema, body, req, globalFormatting) => {
      const data = {
        collectionName,
        schema,
        body,
        validated: {},
        metadata: {},
        req,
        globalFormatting
      };

      if(typeof schema == 'function') {
        data.validated = validateSingleItem(body, schema);
        return data;
      }

      for(const key in schema) {
        const { type, value } = schema[key] || {};
        const schemaKeyType = type || value || schema[key];

        Object.assign(data, { key, schemaKeyType });

        if(isMeta(key)) {
          bookmarkMetaForLater(data, key);
          continue;
        }

        if(isUnique(schema[key])) {
          if (!body[key]) {
            err(`Please provide a unique value for '${key}'.`);
          }

          if (await isADuplicate(data, key)) {
            err(`A duplicate item was found with '${key}=${body[key]}'`);
          }
        }

        if(isWild(data.schemaKeyType)) {
          assignBodyKeyToValidated(data, key);
          continue;
        }

        if(!body.hasOwnProperty(key)) {

          if(schema[key].required) {
            err(`Missing required property ${key}.`);
          }

          if(hasDefault(data, key)) {
            assignDefaultProp(data, key);
            continue;
          }

        }

        if(isType(data).array) {
          await validateItemsInArray(data, key);
          continue;
        }

        if(isType(data).object) {
          await validateSubObject(data, key);
          continue;
        }

        try {
          data.validKey = await getValidatedValue(data, key);

          if(hasFormatting(data, key)) {
            applyFormatting(data, key)
          }
  
          if(globalFormatting) {
            await applyGlobalFormatting(data, globalFormatting);
          }
  
          data.validated[key] = data.validKey;

        } catch(error) {
          err(`Failed to validate schema '${key}': ${data.body[key]} ↓↓↓
          ${error.message}`);
        }
      }

      for(const metaKey in data.metadata) {
        assignMetaToData(data, metaKey);
        
        if(!data.readable) {
          continue;
        }
    
        if(isReferenceToBody(data)) {
          assignMetaReference(data, metaKey);
          continue;
        }

        if(isAConcat(data, metaKey)) {
          concatMetaRefs(data, metaKey);
          continue;
        }

        if(!isFunction(data)) {
          assignMetaValue(data, metaKey);
          continue;
        }

        await applyMetaMethod(data, metaKey);
      }

      return data;
    },
    build: (collectionName, schema, globalFormatting) => ({
      async forSave(body, req) {        
        const keyGen = buildSchemaId(collectionName);
        const { validated, metadata } = await validate.init(collectionName, schema, body, req, globalFormatting);

        return { keyGen, validated, metadata };
      },
      async forUpdate(body, req) {
        const { validated, metadata } = await validate.init(collectionName, schema, body, req, globalFormatting);

        return { validated, metadata };    
      }
    })
  }
}();

export default validate;