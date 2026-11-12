import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { babelParse as parse, parse as parseSfc, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as deviceHelpers from '../src/utils/nursingDevice.js'
import asyncValidator from 'async-validator'

const Schema = asyncValidator.default ?? asyncValidator

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const flush = async () => { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)) }
const ok = async () => ({ code: 200, rows: [], total: 0, data: {} })
const proxy = {
  useDict: () => ({}), resetForm() {}, $refs: {}, $router: { push() {} },
  $modal: { confirm: async () => true, msgError() {}, msgSuccess() {} },
}

// Execute the real SFC setup with Vue reactivity and fixture APIs, without mounting a DOM.
function evaluate(source, mocks = {}, globals = {}, component = false) {
  source = source.replaceAll('import.meta.env.VITE_APP_BASE_API', "'/fixture-api'")
  const ast = parse(source, { sourceType: 'module' })
  const edits = [], exports = [], importedNames = new Set()
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      const declarations = node.specifiers.map(specifier => {
        importedNames.add(specifier.local.name)
        const access = specifier.type === 'ImportDefaultSpecifier' ? '.default'
          : specifier.type === 'ImportNamespaceSpecifier' ? '' : '[' + JSON.stringify(specifier.imported.name) + ']'
        return 'const ' + specifier.local.name + ' = require(' + JSON.stringify(node.source.value) + ')' + access + ';'
      }).join('\n')
      edits.push([node.start, node.end, declarations])
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      exports.push(node.declaration.id.name)
      edits.push([node.start, node.declaration.start, ''])
    }
  }
  for (const [start, end, replacement] of edits.reverse()) source = source.slice(0, start) + replacement + source.slice(end)
  const requireFixture = name => {
    if (name in mocks) return mocks[name]
    if (name === 'vue') return { ...vue, onMounted() {} }
    if (name.endsWith('.vue')) return { default: {} }
    throw new Error('Unmocked import: ' + name)
  }
  const bindings = { ...vue, getCurrentInstance: () => ({ proxy }), onMounted() {}, setTimeout: () => 0, ...globals }
  for (const name of importedNames) delete bindings[name]
  return new Function('require', ...Object.keys(bindings), source + '\nreturn ' + (component ? 'component' : '{' + exports.join(',') + '}'))(
    requireFixture, ...Object.values(bindings))
}

function setup(path, mocks, props = {}, globals = {}) {
  const { descriptor } = parseSfc(read(path))
  const compiled = compileScript(descriptor, { id: 'increment-test', genDefaultAs: 'component' })
  const template = compileTemplate({ source: descriptor.template.content, filename: path, id: 'increment-test' })
  assert.deepEqual(template.errors, [])
  const component = evaluate(compiled.content, mocks, globals, true)
  const events = []
  const scope = vue.effectScope()
  const state = scope.run(() => component.setup(vue.reactive(props), { expose() {}, emit: (...args) => events.push(args) }))
  return { state, events, stop: () => scope.stop() }
}

test('legacy and service products preserve fields and normalize service and sleep identifiers', () => {
  assert.deepEqual(deviceHelpers.normalizeProduct({ productKey: 'old', productName: 'Original' }), {
    productKey: 'old', productName: 'Original', modelType: 'legacy',
  })
  assert.equal(deviceHelpers.normalizeProduct({ productId: 'new', name: 'New' }).productKey, 'new')
  const model = deviceHelpers.normalizeThingModel([{ service_id: 'sleep', properties: [{ property_name: 'HeartRate' }] }])
  assert.equal(model.functionBlocks[0].properties[0].identifier, 'HeartRate')
  assert.equal(deviceHelpers.normalizeDeviceProperties([{ functionId: 'HeartRate', eventTime: 0, value: 0 }])[0].time, 0)
  assert.deepEqual(deviceHelpers.normalizeBedProperties([
    { functionId: 'SleepPhaseState' }, { functionId: 'BedExitCount' }, { functionId: 'BedTime' }, { functionId: 'HeartRate' },
  ]).map(item => item.functionId), ['shuimianzhuangtai', 'lichuangcishu', 'lichuangshijian', 'HeartRate'])
})

test('device API keeps original requests by default and selects encoded REST paths for services', async () => {
  const requests = []
  let data = []
  const api = evaluate(read('src/api/nursing/device.js'), {
    '@/utils/request': { default: async config => { requests.push(config); return { code: 200, data } } },
    '@/utils/nursingDevice': deviceHelpers,
  })
  const device = { iotId: 'id/a', productKey: 'key/a' }
  await api.getDevice(device)
  assert.deepEqual(requests.at(-1), { url: '/nursing/device/queryDeviceDetail', method: 'post', data: device })
  await api.getDevice(device, 'services')
  assert.deepEqual(requests.at(-1), { url: '/nursing/device/id%2Fa', method: 'get' })
  await api.delDevice(device)
  assert.equal(requests.at(-1).data, device)
  await api.delDevice(device, 'services')
  assert.deepEqual(requests.at(-1), { url: '/nursing/device/id%2Fa', method: 'delete' })
  await api.getPublishedList(device)
  assert.equal(requests.at(-1).url, '/nursing/device/queryThingModelPublished')
  data = [{ service_id: 'sleep', properties: [{ property_name: 'HeartRate' }] }]
  const response = await api.getPublishedList(device, 'services')
  assert.equal(requests.at(-1).url, '/nursing/device/queryProduct/key%2Fa')
  assert.equal(JSON.parse(response.data.thingModelJson).functionBlocks[0].functionBlockId, 'sleep')
  await api.getPropertyServiceList('id/a')
  assert.equal(requests.at(-1).url, '/nursing/device/queryServiceProperties/id%2Fa')
  data = [{ productId: 'new', name: 'New' }]
  assert.equal((await api.allProduct()).data[0].modelType, 'services')
})

test('elder selector filters, pages, clears stale selections and ignores out-of-order responses', async () => {
  const calls = [], pending = []
  const fixture = setup('src/views/nursing/checkIn/components/OldManSelect.vue', {
    '@/api/nursing/checkIn': { healthPageQuery: query => { calls.push(query); return new Promise(resolve => pending.push(resolve)) } },
  }, { visible: false })
  const s = fixture.state
  s.loadList()
  s.query.elderName = '甲'
  s.search()
  pending[1]({ rows: [{ id: 2, elderName: '甲' }], total: 1 })
  await flush()
  pending[0]({ rows: [{ id: 1, elderName: '旧结果' }], total: 1 })
  await flush()
  assert.equal(s.rows.value[0].id, 2)
  assert.equal(calls[1].admissionStatus, 1)
  s.selectRow(s.rows.value[0])
  s.confirm()
  assert.deepEqual(fixture.events.map(event => event[0]), ['select', 'close'])
  s.query.pageNum = 2
  const page = s.loadList()
  assert.equal(s.selected.value, null)
  assert.equal(calls.at(-1).pageNum, 2)
  pending[2]({ rows: [], total: 0 })
  await page
  assert.equal(s.loading.value, false)
  fixture.stop()
})

test('assessment selection converts gender without changing the existing elder encoding', () => {
  const fixture = setup('src/views/nursing/checkIn/components/ApplyForm.vue', {
    'element-plus': { ElMessage: { error() {} } }, '@/utils/auth': { getToken: () => 'fixture' },
  }, { type: 'add', applyFormInfo: { phone: 'existing' } })
  fixture.state.selectElder({ elderName: '甲', idCard: 'card', gender: 0 })
  assert.equal(fixture.state.formData.value.sex, 1)
  assert.equal(fixture.state.formData.value.phone, 'existing')
  fixture.state.selectElder({ elderName: '乙', gender: 1 })
  assert.equal(fixture.state.formData.value.sex, 0)
  fixture.stop()
})

test('health upload requires basic information, rejects bad files, and recovers from failure or changed ID', async () => {
  const fixture = setup('src/views/nursing/healthAssessment/index.vue', {
    '@/api/nursing/healthAssessment': { listHealthAssessment: ok, getHealthAssessment: ok, delHealthAssessment: ok, addHealthAssessment: ok, updateHealthAssessment: ok },
    '@/utils/auth': { getToken: () => 'fixture' }, '@/utils/validate': { isCardID() {} },
  })
  const s = fixture.state
  s.formRef.value = { validateField: async () => true }
  assert.equal(s.canUpload.value, false)
  assert.equal(await s.pdfUrlBeforeUpload({ name: 'report.pdf', size: 10 }), false)
  Object.assign(s.form.value, { elderName: '甲', idCard: 'first', physicalExamInstitution: '医院' })
  await flush()
  assert.equal(s.canUpload.value, true)
  assert.equal(await s.pdfUrlBeforeUpload({ name: 'report.exe', size: 10 }), false)
  assert.equal(await s.pdfUrlBeforeUpload({ name: 'report.pdf', size: 61 * 1024 * 1024 }), false)
  assert.equal(await s.pdfUrlBeforeUpload({ name: 'report.pdf', size: 10 }), true)
  assert.equal(s.reportUploading.value, true)
  s.handleUploadError()
  assert.equal(s.reportUploading.value, false)
  assert.equal(s.form.value.physicalReportUrl, null)
  await s.pdfUrlBeforeUpload({ name: 'report.pdf', size: 10 })
  s.handleSuccess({ code: 200, url: '/report.pdf' })
  assert.equal(s.form.value.physicalReportUrl, '/report.pdf')
  await s.pdfUrlBeforeUpload({ name: 'report.pdf', size: 10 })
  s.form.value.idCard = 'changed'
  await flush()
  s.handleSuccess({ code: 200, url: '/wrong-person.pdf' })
  assert.equal(s.form.value.physicalReportUrl, null)
  assert.equal(s.pdfUrlAction.value, '/fixture-api/nursing/healthAssessment/upload')
  fixture.stop()
})

test('reservation range/tab reset, arrival transition and import failure recovery use existing contracts', async () => {
  const updates = []
  const fixture = setup('src/views/nursing/reservation/index.vue', {
    '@/api/nursing/reservation': { listReservation: ok, getReservation: ok, delReservation: ok, addReservation: ok,
      updateReservation: async data => { updates.push(data); return { code: 200 } } },
    '@/utils/auth': { getToken: () => 'fixture' },
  })
  const s = fixture.state
  s.handleDateRangeChange(['start', 'end'])
  s.handleTabChange('1')
  assert.equal(s.queryParams.value.type, 1)
  s.resetQuery()
  assert.equal(s.queryParams.value.startTime, null)
  assert.equal(s.queryParams.value.endTime, null)
  assert.equal(s.queryParams.value.type, null)
  s.arrivalRef.value = { validate: async () => true, clearValidate() {} }
  s.handleArrival({ id: 7, status: 0 })
  s.arrivalForm.value.time = '2026-10-27T10:00:00'
  await s.submitArrival()
  assert.deepEqual(updates[0], { id: 7, status: 1, time: '2026-10-27T10:00:00' })
  assert.equal(s.arrivalSubmitting.value, false)
  assert.equal(s.arrivalDialogVisible.value, false)
  assert.equal(s.beforeImport({ name: 'test.exe' }), false)
  assert.equal(s.beforeImport({ name: 'test.XLSX' }), true)
  s.importError()
  assert.equal(s.importing.value, false)
  assert.equal(s.uploadAction, '/fixture-api/nursing/reservation/import')
  fixture.stop()
})

function deviceFixture(overrides = {}) {
  const registrations = []
  const fixture = setup('src/views/nursing/device/index.vue', {
    '@/api/nursing/device': { listDevice: ok, getDevice: ok, delDevice: ok,
      addDevice: async data => { registrations.push(data); return { code: 200 } },
      updateDevice: ok, syncProductList: ok, allProduct: ok, ...overrides },
    '@/api/nursing/checkIn': { listElderPageQuery: ok }, '@/api/nursing/floor': { getFloorBed: ok },
    '@/utils/commonData': { locationTypeOptions: [] },
  }, {}, { useRouter: () => ({ push() {} }) })
  const s = fixture.state
  s.reset()
  s.options.value = [deviceHelpers.normalizeProduct({ productId: 'p1', name: 'Product' })]
  Object.assign(s.formData.value, { deviceName: '中文设备', nodeId: 'node1', productKey: 'p1' })
  // Element Plus removes trigger before passing each mounted field's rules to async-validator.
  proxy.$refs.deviceRef = {
    clearValidate() {},
    validate: async () => {
      const fields = ['deviceName', 'nodeId', 'productKey', 'locationType', 'bindingLocation']
      const rules = Object.fromEntries(fields.map(key => [key, s.rules[key].map(({ trigger, ...rule }) => rule)]))
      await new Schema(rules).validate(s.formData.value)
      return true
    },
  }
  return { ...fixture, registrations }
}

test('wearable registration follows the documented sentinel and elder ID description', async () => {
  const fixture = deviceFixture()
  const s = fixture.state
  s.handleSelectOld({ id: 2, name: '乙' })
  await s.submitForm()
  assert.deepEqual(fixture.registrations[0], {
    deviceName: '中文设备', nodeId: 'node1', productKey: 'p1', productName: 'Product',
    locationType: 0, bindingLocation: '2', physicalLocationType: -1, deviceDescription: '2', remark: '乙',
  })
  assert.equal(fixture.events.length, 0)
  fixture.stop()
})

test('device registration blocks missing locations and whitespace node IDs', async () => {
  const fixture = deviceFixture()
  const s = fixture.state
  await s.submitForm()
  s.formData.value.locationType = 1
  s.handleRadio()
  await s.submitForm()
  assert.equal(fixture.registrations.length, 0)
  s.formData.value.locationType = 0
  s.handleSelectOld({ id: 1, name: '甲' })
  s.formData.value.nodeId = '   '
  await s.submitForm()
  assert.equal(fixture.registrations.length, 0)
  assert.equal(s.submitting.value, false)
  s.formData.value.nodeId = 'n'.repeat(51)
  await s.submitForm()
  s.formData.value.nodeId = 'node1'
  s.formData.value.deviceName = '名'.repeat(101)
  await s.submitForm()
  assert.equal(fixture.registrations.length, 0)
  fixture.stop()
})

test('device floor room and bed bindings retain full IDs and survive type switches', async () => {
  const fixture = deviceFixture()
  const s = fixture.state
  s.floorData.value = [{ value: '12', label: '二楼', children: [
    { value: '34', label: '201', children: [{ value: '56', label: '1床' }] },
  ] }]
  s.handleSelectOld({ id: 9, name: '甲' })
  s.formData.value.locationType = 1
  s.handleRadio()
  const path = ['12', '34', '56']
  for (let depth = 1; depth <= 3; depth++) {
    s.bedValue.value = path.slice(0, depth)
    s.handleFloor()
    await s.submitForm()
    const body = fixture.registrations.at(-1)
    assert.equal(body.bindingLocation, path[depth - 1])
    assert.equal(body.physicalLocationType, depth - 1)
    assert.equal(body.deviceDescription, path.slice(0, depth).join(','))
  }
  s.formData.value.locationType = 0
  s.handleRadio()
  await s.submitForm()
  assert.equal(fixture.registrations.at(-1).bindingLocation, '9')
  assert.equal(fixture.registrations.at(-1).remark, '甲')
  assert.equal(fixture.registrations.at(-1).physicalLocationType, -1)
  assert.equal(fixture.registrations.at(-1).deviceDescription, '9')
  s.formData.value.locationType = 1
  s.handleRadio()
  assert.equal(s.formData.value.bindingLocation, '56')
  assert.equal(s.formData.value.remark, '二楼,201,1床')
  s.bedValue.value = null
  s.handleFloor()
  await s.submitForm()
  assert.equal(fixture.registrations.length, 4)
  s.reset()
  assert.equal(s.selectedElder.value, null)
  assert.deepEqual(s.bedValue.value, [])
  fixture.stop()
})

test('device submit prevents concurrent requests and releases the button after failure', async () => {
  let rejectRequest
  let count = 0
  const fixture = deviceFixture({ addDevice: () => { count++; return new Promise((_resolve, reject) => { rejectRequest = reject }) } })
  const s = fixture.state
  s.handleSelectOld({ id: 1, name: '甲' })
  const first = s.submitForm()
  await flush()
  await s.submitForm()
  assert.equal(count, 1)
  rejectRequest(new Error('fixture failure'))
  await first
  assert.equal(s.submitting.value, false)
  assert.equal(s.formData.value.bindingLocation, '1')
  fixture.stop()
})

test('smoke and sleep registrations use the selected room or bed ID and full numeric paths', async () => {
  const fixture = deviceFixture()
  const s = fixture.state
  // The same ID may exist at multiple levels. Do not strip digits or add UI prefixes to the request.
  s.floorData.value = [{ value: '1', label: '1楼', children: [{ value: '1', label: '101', children: [
    { value: '5', label: '101-1' },
  ] }] }]
  s.formData.value.locationType = 1
  s.formData.value.deviceName = '烟雾01'
  s.formData.value.nodeId = 'yw01'
  s.bedValue.value = ['1', '1']
  s.handleFloor()
  await s.submitForm()
  assert.deepEqual(fixture.registrations.at(-1), {
    deviceName: '烟雾01', nodeId: 'yw01', productKey: 'p1', productName: 'Product',
    locationType: 1, bindingLocation: '1', physicalLocationType: 1, deviceDescription: '1,1', remark: '1楼,101',
  })
  s.formData.value.deviceName = '睡眠检测带01'
  s.formData.value.nodeId = 'sm01'
  s.bedValue.value = ['1', '1', '5']
  s.handleFloor()
  await s.submitForm()
  assert.deepEqual(fixture.registrations.at(-1), {
    deviceName: '睡眠检测带01', nodeId: 'sm01', productKey: 'p1', productName: 'Product',
    locationType: 1, bindingLocation: '5', physicalLocationType: 2, deviceDescription: '1,1,5', remark: '1楼,101,101-1',
  })
  fixture.stop()
})

test('device elder selector restores confirmed data after cancel and clears selection for searches/pages', async () => {
  const props = vue.reactive({ dialogVisible: false, dialogData: [], pagination: {}, dataLoading: false,
    formData: { bindingLocation: 11, remark: '甲' } })
  const fixture = setup('src/views/nursing/device/components/LookData.vue', {}, props)
  const s = fixture.state
  props.dialogVisible = true
  await flush()
  s.chooseone({ id: 22, name: '乙' })
  s.handleClose()
  props.dialogVisible = false
  await flush()
  props.dialogVisible = true
  await flush()
  s.handleSub()
  assert.deepEqual(fixture.events.find(event => event[0] === 'handleSelectOld'), ['handleSelectOld', { id: 11, name: '甲' }])
  s.chooseone({ id: 22, name: '乙' })
  s.handleSearch()
  assert.equal(s.selected.value, null)
  s.chooseone({ id: 22, name: '乙' })
  s.getList({ page: 2, limit: 5 })
  assert.equal(s.selected.value, null)
  s.chooseone({ id: 22, name: '乙' })
  props.dataLoading = true
  s.handleSub()
  assert.equal(fixture.events.filter(event => event[0] === 'handleSelectOld').length, 1)
  fixture.stop()
})

test('alert rules restore service properties and select legacy modules without an event-object dependency', async () => {
  const calls = []
  let model = { properties: [], functionBlocks: [{ functionBlockId: 'sleep', functionBlockName: 'sleep', properties: [{ identifier: 'HeartRate', name: 'HeartRate' }] }] }
  const fixture = setup('src/views/nursing/alertRule/details.vue', {
    '@/utils/validate': { getNum: Number }, dayjs: { default() {} },
    '@/api/nursing/device': { allProduct: ok, getDeviceList: ok,
      getPublishedList: async (params, modelType) => { calls.push([params, modelType]); return { code: 200, data: { thingModelJson: JSON.stringify(model) } } } },
    '@/api/nursing/alertRule': { getAlertRule: ok, addAlertRule: ok, updateAlertRule: ok },
    '@/utils/commonData': { operatorData: [], continuePeriodData: [], dataType: [], silenceCycleData: [] },
  }, {}, { useRoute: () => ({ query: {} }), useRouter: () => ({ push() {} }) })
  const s = fixture.state
  s.productData.value = [{ productKey: 'new', modelType: 'services' }, { productKey: 'old', modelType: 'legacy' }]
  s.formData.value = { productKey: 'new', moduleId: 'sleep' }
  await s.getPublished('new')
  assert.equal(calls[0][1], 'services')
  assert.equal(s.itemData.value.length, 1)
  assert.equal(s.publishedData.value[0].identifier, 'HeartRate')
  s.handleModele('sleep')
  s.handleIdentifier('HeartRate')
  assert.equal(s.formData.value.functionName, 'HeartRate')
  model = { properties: [], functionBlocks: [{ functionBlockId: 'custom', functionBlockName: 'Custom' }] }
  s.formData.value.productKey = 'old'
  await s.getPublished('old')
  s.handleModele('custom')
  await flush()
  assert.equal(calls.at(-1)[0].functionBlockId, 'custom')
  fixture.stop()
})

test('profile password and avatar changes match Spring parameter and multipart contracts', async () => {
  const requests = []
  const api = evaluate(read('src/api/system/user.js'), {
    '@/utils/request': { default: async config => { requests.push(config); return { code: 200 } } },
    '@/utils/ruoyi': { parseStrEmpty: value => value ?? '' },
  })
  await api.updateUserPwd('old', 'new')
  assert.deepEqual(requests.at(-1).params, { oldPassword: 'old', newPassword: 'new' })
  const avatar = new FormData()
  avatar.append('avatarfile', new Blob(['fixture']), 'fixture.png')
  await api.uploadAvatar(avatar)
  assert.equal(requests.at(-1).data, avatar)
  assert.equal(requests.at(-1).headers, undefined)
})
