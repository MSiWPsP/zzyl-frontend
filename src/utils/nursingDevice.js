// Keep the existing product/thing-model fields while accepting cp424 service models.
export function normalizeProduct(product) {
  return {
    ...product,
    productKey: product.productKey ?? product.productId,
    productName: product.productName ?? product.name,
    modelType: product.productKey == null && product.productId != null ? 'services' : 'legacy',
  }
}

export function normalizeThingModel(services = []) {
  return {
    properties: [],
    functionBlocks: services.map(service => ({
      functionBlockId: service.service_id,
      functionBlockName: service.service_id,
      properties: (service.properties ?? []).map(property => ({
        ...property,
        identifier: property.property_name,
        name: property.property_name,
      })),
    })),
  }
}

export function normalizeDeviceProperties(properties = []) {
  return properties.map(property => ({
    ...property,
    identifier: property.identifier ?? property.functionId,
    name: property.name ?? property.functionId,
    time: property.time ?? property.eventTime,
  }))
}

// cp424 renamed three sleep properties; keep the existing bed cards and icons.
export function normalizeBedProperties(properties = []) {
  const aliases = { SleepPhaseState: 'shuimianzhuangtai', BedExitCount: 'lichuangcishu', BedTime: 'lichuangshijian' }
  return properties.map(property => ({ ...property, functionId: aliases[property.functionId] ?? property.functionId }))
}
