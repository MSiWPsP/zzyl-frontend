# cp424 功能增量合并记录

来源：`D:\DevelopmentRepository\AntiGravityProjects\cp424-vue3-master`。
目标基线：`86b0ec2`，分支 `master`。开始合并时目标工作区干净；来源目录没有 Git 历史。

比较时排除 `.git`、`node_modules`、`dist`、`dist.zip` 和编辑器目录，按文件内容比较并忽略换行与排版差异。来源并非当前项目的完整升级版本：公共框架中含有旧实现，护理等级、计划、任务接口也与当前后端命名不同，因此按功能合并而非覆盖目录。

## 合入内容

| 功能 | 增量与兼容处理 |
| --- | --- |
| 入住申请 | 增加已评估老人选择、姓名/身份证搜索、分页与信息回填；仍可手工填写，详情只读模式不显示选择按钮。修复来源弹窗缺失 `constants`、选择值/分页事件不一致的问题。健康评估的 `gender` 为 0男/1女，回填时转换为当前老人档案的 `sex`（1男/0女）。 |
| 老人列表接口 | 将来源中的 `/nursing/elder/list` 修正合入，已核对本地 `zzyl` 的 `ElderController`；健康评估列表复用现有 API，不复制请求代码。 |
| 预约管理 | 增加状态与时间范围筛选、参观/探访页签、到院确认、取消预约、Excel 导入导出。保留现有修改/删除操作；重置时同步清除日期范围和预约类型。上传使用当前环境 API 前缀。 |
| 体检报告 | 基本信息通过校验后才能上传 PDF，上传成功后才可提交；失败后恢复交互，身份证变更使旧报告失效。保留当前详情页和分析流程。 |
| 设备与产品 | 兼容原 `productKey/productName` 和来源 `productId/name`。原格式继续走原 POST 查询/DELETE 请求；新格式使用来源的 REST 查询、删除和服务属性 API，登记时携带 `nodeId`。保留原设备详情页签和旧登记请求体。 |
| 告警规则 | 兼容来源的 `service_id/properties/property_name`，回填服务和属性；修复 Element Plus change 事件没有 `selectedOptions` 导致的模块选择错误。保留原物模型格式。 |
| 智慧床位 | 将 `SleepPhaseState/BedExitCount/BedTime` 映射到现有卡片使用的属性，兼容两种上报命名并复用现有图标。 |
| 个人资料 | 合入密码更新使用 query 参数、头像上传不强制表单编码的修正，已核对本地 `SysProfileController` 的参数与 MultipartFile 签名。 |
| 单选框兼容 | 合入来源在护理项目、系统管理与代码生成页面的 22 处 `value` → `label` 属性修正，适配当前 Element Plus 2.4.3；不替换页面布局与其他逻辑。 |
| 公共组件与依赖 | 注册已有 TreeSelect 组件；把已被多个页面使用的 dayjs 声明为直接依赖，并复用现有 pnpm 锁文件中的版本范围，不升级 Vue、Element Plus、Vite 等依赖。 |
| 容器与 CI | 合入 Dockerfile、Jenkinsfile、deploy.sh，并补上 Docker 忽略规则、Nginx history 回退和 `/prod-api/` 代理。修复来源部署脚本中容器名称判断不一致、模糊匹配删除等问题。没有执行部署。 |

## 来源独有文件的处理

| 来源独有文件 | 处理 |
| --- | --- |
| `Dockerfile`、`Jenkinsfile`、`deploy.sh` | 合入并按当前项目适配。 |
| `src/views/nursing/checkIn/components/OldManSelect.vue` | 合入并修复，使用当前 Vue/Element Plus 组件。 |
| `src/api/nursing/nursingLevel.js`、`nursingPlan.js`、`nursingTask.js` | 与现有 `level.js`、`plan.js`、`task.js` 功能重叠；保留当前接口 `/nursing/level`、`/nursing/plan`、`/nursing/task`，不重复新增模块。 |
| `src/views/nursing/nursingLevel/index.vue`、`nursingPlan/index.vue`、`nursingPlan/index.scss` | 与当前 `level/`、`plan/` 页面重叠，沿用当前实现及状态图标修复。 |
| `.env`、`.env.test` | 来源新增的默认开发配置和 WebSocket 地址；当前代码未使用该 WebSocket 变量，保留当前各环境配置，避免生产环境混入开发默认值。 |
| `public/favicon_bak.ico`、`src/assets/logo/logo_bak.png` | 备份资源，未引入。 |
| `src/assets/images/background-login.jpg` | 来源的替代登录背景，保留当前登录页与资源。 |

## 保留当前项目的部分

- Cron 表单修复、后端预览接口及提交校验。
- 当前护理等级/计划/任务 API、页面目录、路由及护理员部门编号，不替换成来源的路由和编号。
- 当前布局、主题/暗色样式、侧栏、登录页、端口和环境配置。
- 当前代码生成建表功能、Vue 3 插槽写法、校验规则、文件名限制及其他公共组件改进；来源中的旧实现、调试日志、无效导入与纯排版变动未覆盖进来。
- 当前现有修改/删除等业务操作；来源删去现有功能的变更不直接合入。

## 设备接口选择

`allProduct` 返回原字段时标记为 `legacy`，返回 `productId/name` 时标记为 `services`。设备列表编辑/删除、详情跳转和告警规则据此选择请求；API 函数默认仍是 `legacy`。

来源新增设备接口：

- `GET /nursing/device/{iotId}`
- `GET /nursing/device/queryProduct/{productKey}`
- `GET /nursing/device/queryServiceProperties/{iotId}`
- `DELETE /nursing/device/{iotId}`

预约导入沿用来源页面的 `POST /nursing/reservation/import`（multipart），导出使用当前通用下载函数的 `POST /nursing/reservation/export`。来源未被页面调用的 `/importData` API 不另行引入。

## 容器使用

在支持 Docker 的构建/部署环境执行：

```sh
docker build -t zzyl-vue:increment .
BACKEND_URL=http://backend:8080 FRONTEND_PORT=9901 sh ./deploy.sh zzyl-vue increment
```

`BACKEND_URL` 必须从容器内可访问，且不带末尾 `/`。默认指向宿主机 8080；脚本添加宿主机地址映射。Jenkins 使用 SCM 中的 Jenkinsfile，并提供镜像标签、后端 URL、前端端口参数。脚本只操作明确命名的同名容器，执行前先校验镜像存在。

`.gitattributes` 仅固定新部署脚本使用 LF 换行，避免 Windows Git 的 CRLF 转换影响 shell 执行。

## 验证与边界

- `npm run test:increment`：9 项 Node 行为回归通过。执行真实 Vue SFC setup、Vue 响应式逻辑与模板编译，使用内存 API fixture；覆盖选择/分页/旧响应、性别转换、上传失败恢复、预约状态操作、原设备请求保持、新服务请求、设备登记 payload、告警回填和个人资料请求。
- `npm run build:prod -- --outDir <临时目录>`：生产构建通过；未改动当前 `dist`。构建保留了首页和智慧床位已有的图片路径、包体积告警。
- `git diff --check`：通过。
- `bash -n deploy.sh`：shell 语法检查通过。
- 未连接真实后端/数据库验证预约、设备、告警或 AI 分析，也未执行浏览器交互验收或 Docker/Jenkins 部署。新增业务可用性仍取决于对应后端实现；前端构建与 fixture 验证不等同于联调成功。

撤回本次增量可对本次提交执行 `git revert <commit>`，不需要覆盖现有目录。
