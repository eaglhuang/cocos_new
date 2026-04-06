"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('Tool Manager panel shown'); },
        hide() { console.log('Tool Manager panel hidden'); }
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/default/tool-manager.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        panelTitle: '#panelTitle',
        createConfigBtn: '#createConfigBtn',
        importConfigBtn: '#importConfigBtn',
        exportConfigBtn: '#exportConfigBtn',
        configSelector: '#configSelector',
        applyConfigBtn: '#applyConfigBtn',
        editConfigBtn: '#editConfigBtn',
        deleteConfigBtn: '#deleteConfigBtn',
        toolsContainer: '#toolsContainer',
        selectAllBtn: '#selectAllBtn',
        deselectAllBtn: '#deselectAllBtn',
        saveChangesBtn: '#saveChangesBtn',
        totalToolsCount: '#totalToolsCount',
        enabledToolsCount: '#enabledToolsCount',
        disabledToolsCount: '#disabledToolsCount',
        configModal: '#configModal',
        modalTitle: '#modalTitle',
        configForm: '#configForm',
        configName: '#configName',
        configDescription: '#configDescription',
        closeModal: '#closeModal',
        cancelConfigBtn: '#cancelConfigBtn',
        saveConfigBtn: '#saveConfigBtn',
        importModal: '#importModal',
        importConfigJson: '#importConfigJson',
        closeImportModal: '#closeImportModal',
        cancelImportBtn: '#cancelImportBtn',
        confirmImportBtn: '#confirmImportBtn'
    },
    methods: {
        async loadToolManagerState() {
            try {
                this.toolManagerState = await Editor.Message.request('cocos-mcp-server', 'getToolManagerState');
                this.currentConfiguration = this.toolManagerState.currentConfiguration;
                this.configurations = this.toolManagerState.configurations;
                this.availableTools = this.toolManagerState.availableTools;
                this.updateUI();
            }
            catch (error) {
                console.error('Failed to load tool manager state:', error);
                this.showError('加载工具管理器状态失败');
            }
        },
        updateUI() {
            this.updateConfigSelector();
            this.updateToolsDisplay();
            this.updateStatusBar();
            this.updateButtons();
        },
        updateConfigSelector() {
            const selector = this.$.configSelector;
            selector.innerHTML = '<option value="">选择配置...</option>';
            this.configurations.forEach((config) => {
                const option = document.createElement('option');
                option.value = config.id;
                option.textContent = config.name;
                if (this.currentConfiguration && config.id === this.currentConfiguration.id) {
                    option.selected = true;
                }
                selector.appendChild(option);
            });
        },
        updateToolsDisplay() {
            const container = this.$.toolsContainer;
            if (!this.currentConfiguration) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>没有选择配置</h3>
                        <p>请先选择一个配置或创建新配置</p>
                    </div>
                `;
                return;
            }
            const toolsByCategory = {};
            this.currentConfiguration.tools.forEach((tool) => {
                if (!toolsByCategory[tool.category]) {
                    toolsByCategory[tool.category] = [];
                }
                toolsByCategory[tool.category].push(tool);
            });
            container.innerHTML = '';
            Object.entries(toolsByCategory).forEach(([category, tools]) => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'tool-category';
                const enabledCount = tools.filter((t) => t.enabled).length;
                const totalCount = tools.length;
                categoryDiv.innerHTML = `
                    <div class="category-header">
                        <div class="category-name">${this.getCategoryDisplayName(category)}</div>
                        <div class="category-toggle">
                            <span>${enabledCount}/${totalCount}</span>
                            <input type="checkbox" class="checkbox category-checkbox" 
                                   data-category="${category}" 
                                   ${enabledCount === totalCount ? 'checked' : ''}>
                        </div>
                    </div>
                    <div class="tool-list">
                        ${tools.map((tool) => `
                            <div class="tool-item">
                                <div class="tool-info">
                                    <div class="tool-name">${tool.name}</div>
                                    <div class="tool-description">${tool.description}</div>
                                </div>
                                <div class="tool-toggle">
                                    <input type="checkbox" class="checkbox tool-checkbox" 
                                           data-category="${tool.category}" 
                                           data-name="${tool.name}" 
                                           ${tool.enabled ? 'checked' : ''}>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(categoryDiv);
            });
            this.bindToolEvents();
        },
        bindToolEvents() {
            document.querySelectorAll('.category-checkbox').forEach((checkbox) => {
                checkbox.addEventListener('change', (e) => {
                    const category = e.target.dataset.category;
                    const checked = e.target.checked;
                    this.toggleCategoryTools(category, checked);
                });
            });
            document.querySelectorAll('.tool-checkbox').forEach((checkbox) => {
                checkbox.addEventListener('change', (e) => {
                    const category = e.target.dataset.category;
                    const name = e.target.dataset.name;
                    const enabled = e.target.checked;
                    this.updateToolStatus(category, name, enabled);
                });
            });
        },
        async toggleCategoryTools(category, enabled) {
            if (!this.currentConfiguration)
                return;
            console.log(`Toggling category tools: ${category} = ${enabled}`);
            const categoryTools = this.currentConfiguration.tools.filter((tool) => tool.category === category);
            if (categoryTools.length === 0)
                return;
            const updates = categoryTools.map((tool) => ({
                category: tool.category,
                name: tool.name,
                enabled: enabled
            }));
            try {
                // 先更新本地状态
                categoryTools.forEach((tool) => {
                    tool.enabled = enabled;
                });
                console.log(`Updated local category state: ${category} = ${enabled}`);
                // 立即更新UI
                this.updateStatusBar();
                this.updateCategoryCounts();
                this.updateToolCheckboxes(category, enabled);
                // 然后发送到后端
                await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', this.currentConfiguration.id, updates);
            }
            catch (error) {
                console.error('Failed to toggle category tools:', error);
                this.showError('切换类别工具失败');
                // 如果后端更新失败，回滚本地状态
                categoryTools.forEach((tool) => {
                    tool.enabled = !enabled;
                });
                this.updateStatusBar();
                this.updateCategoryCounts();
                this.updateToolCheckboxes(category, !enabled);
            }
        },
        async updateToolStatus(category, name, enabled) {
            if (!this.currentConfiguration)
                return;
            console.log(`Updating tool status: ${category}.${name} = ${enabled}`);
            console.log(`Current config ID: ${this.currentConfiguration.id}`);
            // 先更新本地状态
            const tool = this.currentConfiguration.tools.find((t) => t.category === category && t.name === name);
            if (!tool) {
                console.error(`Tool not found: ${category}.${name}`);
                return;
            }
            try {
                tool.enabled = enabled;
                console.log(`Updated local tool state: ${tool.name} = ${tool.enabled}`);
                // 立即更新UI（只更新统计信息，不重新渲染工具列表）
                this.updateStatusBar();
                this.updateCategoryCounts();
                // 然后发送到后端
                console.log(`Sending to backend: configId=${this.currentConfiguration.id}, category=${category}, name=${name}, enabled=${enabled}`);
                const result = await Editor.Message.request('cocos-mcp-server', 'updateToolStatus', this.currentConfiguration.id, category, name, enabled);
                console.log('Backend response:', result);
            }
            catch (error) {
                console.error('Failed to update tool status:', error);
                this.showError('更新工具状态失败');
                // 如果后端更新失败，回滚本地状态
                tool.enabled = !enabled;
                this.updateStatusBar();
                this.updateCategoryCounts();
            }
        },
        updateStatusBar() {
            if (!this.currentConfiguration) {
                this.$.totalToolsCount.textContent = '0';
                this.$.enabledToolsCount.textContent = '0';
                this.$.disabledToolsCount.textContent = '0';
                return;
            }
            const total = this.currentConfiguration.tools.length;
            const enabled = this.currentConfiguration.tools.filter((t) => t.enabled).length;
            const disabled = total - enabled;
            console.log(`Status bar update: total=${total}, enabled=${enabled}, disabled=${disabled}`);
            this.$.totalToolsCount.textContent = total.toString();
            this.$.enabledToolsCount.textContent = enabled.toString();
            this.$.disabledToolsCount.textContent = disabled.toString();
        },
        updateCategoryCounts() {
            if (!this.currentConfiguration)
                return;
            // 更新每个类别的计数显示
            document.querySelectorAll('.category-checkbox').forEach((checkbox) => {
                const category = checkbox.dataset.category;
                const categoryTools = this.currentConfiguration.tools.filter((t) => t.category === category);
                const enabledCount = categoryTools.filter((t) => t.enabled).length;
                const totalCount = categoryTools.length;
                // 更新计数显示
                const countSpan = checkbox.parentElement.querySelector('span');
                if (countSpan) {
                    countSpan.textContent = `${enabledCount}/${totalCount}`;
                }
                // 更新类别复选框状态
                checkbox.checked = enabledCount === totalCount;
            });
        },
        updateToolCheckboxes(category, enabled) {
            // 更新特定类别的所有工具复选框
            document.querySelectorAll(`.tool-checkbox[data-category="${category}"]`).forEach((checkbox) => {
                checkbox.checked = enabled;
            });
        },
        updateButtons() {
            const hasCurrentConfig = !!this.currentConfiguration;
            this.$.editConfigBtn.disabled = !hasCurrentConfig;
            this.$.deleteConfigBtn.disabled = !hasCurrentConfig;
            this.$.exportConfigBtn.disabled = !hasCurrentConfig;
            this.$.applyConfigBtn.disabled = !hasCurrentConfig;
        },
        async createConfiguration() {
            this.editingConfig = null;
            this.$.modalTitle.textContent = '新建配置';
            this.$.configName.value = '';
            this.$.configDescription.value = '';
            this.showModal('configModal');
        },
        async editConfiguration() {
            if (!this.currentConfiguration)
                return;
            this.editingConfig = this.currentConfiguration;
            this.$.modalTitle.textContent = '编辑配置';
            this.$.configName.value = this.currentConfiguration.name;
            this.$.configDescription.value = this.currentConfiguration.description || '';
            this.showModal('configModal');
        },
        async saveConfiguration() {
            const name = this.$.configName.value.trim();
            const description = this.$.configDescription.value.trim();
            if (!name) {
                this.showError('配置名称不能为空');
                return;
            }
            try {
                if (this.editingConfig) {
                    await Editor.Message.request('cocos-mcp-server', 'updateToolConfiguration', this.editingConfig.id, { name, description });
                }
                else {
                    await Editor.Message.request('cocos-mcp-server', 'createToolConfiguration', name, description);
                }
                this.hideModal('configModal');
                await this.loadToolManagerState();
            }
            catch (error) {
                console.error('Failed to save configuration:', error);
                this.showError('保存配置失败');
            }
        },
        async deleteConfiguration() {
            if (!this.currentConfiguration)
                return;
            const confirmed = await Editor.Dialog.warn('确认删除', {
                detail: `确定要删除配置 "${this.currentConfiguration.name}" 吗？此操作不可撤销。`
            });
            if (confirmed) {
                try {
                    await Editor.Message.request('cocos-mcp-server', 'deleteToolConfiguration', this.currentConfiguration.id);
                    await this.loadToolManagerState();
                }
                catch (error) {
                    console.error('Failed to delete configuration:', error);
                    this.showError('删除配置失败');
                }
            }
        },
        async applyConfiguration() {
            const configId = this.$.configSelector.value;
            if (!configId)
                return;
            try {
                await Editor.Message.request('cocos-mcp-server', 'setCurrentToolConfiguration', configId);
                await this.loadToolManagerState();
            }
            catch (error) {
                console.error('Failed to apply configuration:', error);
                this.showError('应用配置失败');
            }
        },
        async exportConfiguration() {
            if (!this.currentConfiguration)
                return;
            try {
                const result = await Editor.Message.request('cocos-mcp-server', 'exportToolConfiguration', this.currentConfiguration.id);
                Editor.Clipboard.write('text', result.configJson);
                Editor.Dialog.info('导出成功', { detail: '配置已复制到剪贴板' });
            }
            catch (error) {
                console.error('Failed to export configuration:', error);
                this.showError('导出配置失败');
            }
        },
        async importConfiguration() {
            this.$.importConfigJson.value = '';
            this.showModal('importModal');
        },
        async confirmImport() {
            const configJson = this.$.importConfigJson.value.trim();
            if (!configJson) {
                this.showError('请输入配置JSON');
                return;
            }
            try {
                await Editor.Message.request('cocos-mcp-server', 'importToolConfiguration', configJson);
                this.hideModal('importModal');
                await this.loadToolManagerState();
                Editor.Dialog.info('导入成功', { detail: '配置已成功导入' });
            }
            catch (error) {
                console.error('Failed to import configuration:', error);
                this.showError('导入配置失败');
            }
        },
        async selectAllTools() {
            if (!this.currentConfiguration)
                return;
            console.log('Selecting all tools');
            const updates = this.currentConfiguration.tools.map((tool) => ({
                category: tool.category,
                name: tool.name,
                enabled: true
            }));
            try {
                // 先更新本地状态
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = true;
                });
                console.log('Updated local state: all tools enabled');
                // 立即更新UI
                this.updateStatusBar();
                this.updateToolsDisplay();
                // 然后发送到后端
                await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', this.currentConfiguration.id, updates);
            }
            catch (error) {
                console.error('Failed to select all tools:', error);
                this.showError('全选工具失败');
                // 如果后端更新失败，回滚本地状态
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = false;
                });
                this.updateStatusBar();
                this.updateToolsDisplay();
            }
        },
        async deselectAllTools() {
            if (!this.currentConfiguration)
                return;
            console.log('Deselecting all tools');
            const updates = this.currentConfiguration.tools.map((tool) => ({
                category: tool.category,
                name: tool.name,
                enabled: false
            }));
            try {
                // 先更新本地状态
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = false;
                });
                console.log('Updated local state: all tools disabled');
                // 立即更新UI
                this.updateStatusBar();
                this.updateToolsDisplay();
                // 然后发送到后端
                await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', this.currentConfiguration.id, updates);
            }
            catch (error) {
                console.error('Failed to deselect all tools:', error);
                this.showError('取消全选工具失败');
                // 如果后端更新失败，回滚本地状态
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = true;
                });
                this.updateStatusBar();
                this.updateToolsDisplay();
            }
        },
        getCategoryDisplayName(category) {
            const categoryNames = {
                'scene': '场景工具',
                'node': '节点工具',
                'component': '组件工具',
                'prefab': '预制体工具',
                'project': '项目工具',
                'debug': '调试工具',
                'preferences': '偏好设置工具',
                'server': '服务器工具',
                'broadcast': '广播工具',
                'sceneAdvanced': '高级场景工具',
                'sceneView': '场景视图工具',
                'referenceImage': '参考图片工具',
                'assetAdvanced': '高级资源工具',
                'validation': '验证工具'
            };
            return categoryNames[category] || category;
        },
        showModal(modalId) {
            this.$[modalId].style.display = 'block';
        },
        hideModal(modalId) {
            this.$[modalId].style.display = 'none';
        },
        showError(message) {
            Editor.Dialog.error('错误', { detail: message });
        },
        async saveChanges() {
            if (!this.currentConfiguration) {
                this.showError('没有选择配置');
                return;
            }
            try {
                // 确保当前配置已保存到后端
                await Editor.Message.request('cocos-mcp-server', 'updateToolConfiguration', this.currentConfiguration.id, {
                    name: this.currentConfiguration.name,
                    description: this.currentConfiguration.description,
                    tools: this.currentConfiguration.tools
                });
                Editor.Dialog.info('保存成功', { detail: '配置更改已保存' });
            }
            catch (error) {
                console.error('Failed to save changes:', error);
                this.showError('保存更改失败');
            }
        },
        bindEvents() {
            this.$.createConfigBtn.addEventListener('click', this.createConfiguration.bind(this));
            this.$.editConfigBtn.addEventListener('click', this.editConfiguration.bind(this));
            this.$.deleteConfigBtn.addEventListener('click', this.deleteConfiguration.bind(this));
            this.$.applyConfigBtn.addEventListener('click', this.applyConfiguration.bind(this));
            this.$.exportConfigBtn.addEventListener('click', this.exportConfiguration.bind(this));
            this.$.importConfigBtn.addEventListener('click', this.importConfiguration.bind(this));
            this.$.selectAllBtn.addEventListener('click', this.selectAllTools.bind(this));
            this.$.deselectAllBtn.addEventListener('click', this.deselectAllTools.bind(this));
            this.$.saveChangesBtn.addEventListener('click', this.saveChanges.bind(this));
            this.$.closeModal.addEventListener('click', () => this.hideModal('configModal'));
            this.$.cancelConfigBtn.addEventListener('click', () => this.hideModal('configModal'));
            this.$.configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveConfiguration();
            });
            this.$.closeImportModal.addEventListener('click', () => this.hideModal('importModal'));
            this.$.cancelImportBtn.addEventListener('click', () => this.hideModal('importModal'));
            this.$.confirmImportBtn.addEventListener('click', this.confirmImport.bind(this));
            this.$.configSelector.addEventListener('change', this.applyConfiguration.bind(this));
        }
    },
    ready() {
        this.toolManagerState = null;
        this.currentConfiguration = null;
        this.configurations = [];
        this.availableTools = [];
        this.editingConfig = null;
        this.bindEvents();
        this.loadToolManagerState();
    },
    beforeClose() {
        // 清理工作
    },
    close() {
        // 面板关闭清理
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL3Rvb2wtbWFuYWdlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHVDQUF3QztBQUN4QywrQkFBNEI7QUFFNUIsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxTQUFTLEVBQUU7UUFDUCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN2RDtJQUNELFFBQVEsRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLG9EQUFvRCxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3RHLEtBQUssRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLHlDQUF5QyxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3hGLENBQUMsRUFBRTtRQUNDLFVBQVUsRUFBRSxhQUFhO1FBQ3pCLGVBQWUsRUFBRSxrQkFBa0I7UUFDbkMsZUFBZSxFQUFFLGtCQUFrQjtRQUNuQyxlQUFlLEVBQUUsa0JBQWtCO1FBQ25DLGNBQWMsRUFBRSxpQkFBaUI7UUFDakMsY0FBYyxFQUFFLGlCQUFpQjtRQUNqQyxhQUFhLEVBQUUsZ0JBQWdCO1FBQy9CLGVBQWUsRUFBRSxrQkFBa0I7UUFDbkMsY0FBYyxFQUFFLGlCQUFpQjtRQUNqQyxZQUFZLEVBQUUsZUFBZTtRQUM3QixjQUFjLEVBQUUsaUJBQWlCO1FBQ2pDLGNBQWMsRUFBRSxpQkFBaUI7UUFDakMsZUFBZSxFQUFFLGtCQUFrQjtRQUNuQyxpQkFBaUIsRUFBRSxvQkFBb0I7UUFDdkMsa0JBQWtCLEVBQUUscUJBQXFCO1FBQ3pDLFdBQVcsRUFB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RixJQUFJLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRWpGLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDekYsQ0FBQztLQUNKO0lBQ0QsS0FBSztRQUNBLElBQVksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7UUFDckMsSUFBWSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQztRQUN6QyxJQUFZLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUNqQyxJQUFZLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUNqQyxJQUFZLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUVsQyxJQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDMUIsSUFBWSxDQUFDLG9CQUFvQixFQUFFLENBQUM7SUFDekMsQ0FBQztJQUNELFdBQVc7UUFDUCxPQUFPO0lBQ1gsQ0FBQztJQUNELEtBQUs7UUFDRCxTQUFTO0lBQ2IsQ0FBQztDQUNHLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzLWV4dHJhJztcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3IuUGFuZWwuZGVmaW5lKHtcclxuICAgIGxpc3RlbmVyczoge1xyXG4gICAgICAgIHNob3coKSB7IGNvbnNvbGUubG9nKCdUb29sIE1hbmFnZXIgcGFuZWwgc2hvd24nKTsgfSxcclxuICAgICAgICBoaWRlKCkgeyBjb25zb2xlLmxvZygnVG9vbCBNYW5hZ2VyIHBhbmVsIGhpZGRlbicpOyB9XHJcbiAgICB9LFxyXG4gICAgdGVtcGxhdGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy90ZW1wbGF0ZS9kZWZhdWx0L3Rvb2wtbWFuYWdlci5odG1sJyksICd1dGYtOCcpLFxyXG4gICAgc3R5bGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy9zdHlsZS9kZWZhdWx0L2luZGV4LmNzcycpLCAndXRmLTgnKSxcclxuICAgICQ6IHtcclxuICAgICAgICBwYW5lbFRpdGxlOiAnI3BhbmVsVGl0bGUnLFxyXG4gICAgICAgIGNyZWF0ZUNvbmZpZ0J0bjogJyNjcmVhdGVDb25maWdCdG4nLFxyXG4gICAgICAgIGltcG9ydENvbmZpZ0J0bjogJyNpbXBvcnRDb25maWdCdG4nLFxyXG4gICAgICAgIGV4cG9ydENvbmZpZ0J0bjogJyNleHBvcnRDb25maWdCdG4nLFxyXG4gICAgICAgIGNvbmZpZ1NlbGVjdG9yOiAnI2NvbmZpZ1NlbGVjdG9yJyxcclxuICAgICAgICBhcHBseUNvbmZpZ0J0bjogJyNhcHBseUNvbmZpZ0J0bicsXHJcbiAgICAgICAgZWRpdENvbmZpZ0J0bjogJyNlZGl0Q29uZmlnQnRuJyxcclxuICAgICAgICBkZWxldGVDb25maWdCdG46ICcjZGVsZXRlQ29uZmlnQnRuJyxcclxuICAgICAgICB0b29sc0NvbnRhaW5lcjogJyN0b29sc0NvbnRhaW5lcicsXHJcbiAgICAgICAgc2VsZWN0QWxsQnRuOiAnI3NlbGVjdEFsbEJ0bicsXHJcbiAgICAgICAgZGVzZWxlY3RBbGxCdG46ICcjZGVzZWxlY3RBbGxCdG4nLFxyXG4gICAgICAgIHNhdmVDaGFuZ2VzQnRuOiAnI3NhdmVDaGFuZ2VzQnRuJyxcclxuICAgICAgICB0b3RhbFRvb2xzQ291bnQ6ICcjdG90YWxUb29sc0NvdW50JyxcclxuICAgICAgICBlbmFibGVkVG9vbHNDb3VudDogJyNlbmFibGVkVG9vbHNDb3VudCcsXHJcbiAgICAgICAgZGlzYWJsZWRUb29sc0NvdW50OiAnI2Rpc2FibGVkVG9vbHNDb3VudCcsXHJcbiAgICAgICAgY29uZmlnTW9kYWw6ICcjY29uZmlnTW9kYWwnLFxyXG4gICAgICAgIG1vZGFsVGl0bGU6ICcjbW9kYWxUaXRsZScsXHJcbiAgICAgICAgY29uZmlnRm9ybTogJyNjb25maWdGb3JtJyxcclxuICAgICAgICBjb25maWdOYW1lOiAnI2NvbmZpZ05hbWUnLFxyXG4gICAgICAgIGNvbmZpZ0Rlc2NyaXB0aW9uOiAnI2NvbmZpZ0Rlc2NyaXB0aW9uJyxcclxuICAgICAgICBjbG9zZU1vZGFsOiAnI2Nsb3NlTW9kYWwnLFxyXG4gICAgICAgIGNhbmNlbENvbmZpZ0J0bjogJyNjYW5jZWxDb25maWdCdG4nLFxyXG4gICAgICAgIHNhdmVDb25maWdCdG46ICcjc2F2ZUNvbmZpZ0J0bicsXHJcbiAgICAgICAgaW1wb3J0TW9kYWw6ICcjaW1wb3J0TW9kYWwnLFxyXG4gICAgICAgIGltcG9ydENvbmZpZ0pzb246ICcjaW1wb3J0Q29uZmlnSnNvbicsXHJcbiAgICAgICAgY2xvc2VJbXBvcnRNb2RhbDogJyNjbG9zZUltcG9ydE1vZGFsJyxcclxuICAgICAgICBjYW5jZWxJbXBvcnRCdG46ICcjY2FuY2VsSW1wb3J0QnRuJyxcclxuICAgICAgICBjb25maXJtSW1wb3J0QnRuOiAnI2NvbmZpcm1JbXBvcnRCdG4nXHJcbiAgICB9LFxyXG4gICAgbWV0aG9kczoge1xyXG4gICAgICAgIGFzeW5jIGxvYWRUb29sTWFuYWdlclN0YXRlKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50b29sTWFuYWdlclN0YXRlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICdnZXRUb29sTWFuYWdlclN0YXRlJyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uID0gdGhpcy50b29sTWFuYWdlclN0YXRlLmN1cnJlbnRDb25maWd1cmF0aW9uO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWd1cmF0aW9ucyA9IHRoaXMudG9vbE1hbmFnZXJTdGF0ZS5jb25maWd1cmF0aW9ucztcclxuICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlVG9vbHMgPSB0aGlzLnRvb2xNYW5hZ2VyU3RhdGUuYXZhaWxhYmxlVG9vbHM7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVJKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gbG9hZCB0b29sIG1hbmFnZXIgc3RhdGU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ+WKoOi9veW3peWFt+euoeeQhuWZqOeKtuaAgeWksei0pScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgdXBkYXRlVUkodGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlQ29uZmlnU2VsZWN0b3IoKTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVUb29sc0Rpc3BsYXkoKTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVCdXR0b25zKCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgdXBkYXRlQ29uZmlnU2VsZWN0b3IodGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy4kLmNvbmZpZ1NlbGVjdG9yO1xyXG4gICAgICAgICAgICBzZWxlY3Rvci5pbm5lckhUTUwgPSAnPG9wdGlvbiB2YWx1ZT1cIlwiPumAieaLqemFjee9ri4uLjwvb3B0aW9uPic7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLmNvbmZpZ3VyYXRpb25zLmZvckVhY2goKGNvbmZpZzogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcclxuICAgICAgICAgICAgICAgIG9wdGlvbi52YWx1ZSA9IGNvbmZpZy5pZDtcclxuICAgICAgICAgICAgICAgIG9wdGlvbi50ZXh0Q29udGVudCA9IGNvbmZpZy5uYW1lO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24gJiYgY29uZmlnLmlkID09PSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLmlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uLnNlbGVjdGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHNlbGVjdG9yLmFwcGVuZENoaWxkKG9wdGlvbik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHVwZGF0ZVRvb2xzRGlzcGxheSh0aGlzOiBhbnkpIHtcclxuICAgICAgICAgICAgY29uc3QgY29udGFpbmVyID0gdGhpcy4kLnRvb2xzQ29udGFpbmVyO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8aDM+5rKh5pyJ6YCJ5oup6YWN572uPC9oMz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHA+6K+35YWI6YCJ5oup5LiA5Liq6YWN572u5oiW5Yib5bu65paw6YWN572uPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgYDtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgdG9vbHNCeUNhdGVnb3J5OiBhbnkgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5mb3JFYWNoKCh0b29sOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICghdG9vbHNCeUNhdGVnb3J5W3Rvb2wuY2F0ZWdvcnldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHNCeUNhdGVnb3J5W3Rvb2wuY2F0ZWdvcnldID0gW107XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0b29sc0J5Q2F0ZWdvcnlbdG9vbC5jYXRlZ29yeV0ucHVzaCh0b29sKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBPYmplY3QuZW50cmllcyh0b29sc0J5Q2F0ZWdvcnkpLmZvckVhY2goKFtjYXRlZ29yeSwgdG9vbHNdOiBbc3RyaW5nLCBhbnldKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjYXRlZ29yeURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnlEaXYuY2xhc3NOYW1lID0gJ3Rvb2wtY2F0ZWdvcnknO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbmFibGVkQ291bnQgPSB0b29scy5maWx0ZXIoKHQ6IGFueSkgPT4gdC5lbmFibGVkKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0b3RhbENvdW50ID0gdG9vbHMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjYXRlZ29yeURpdi5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhdGVnb3J5LWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2F0ZWdvcnktbmFtZVwiPiR7dGhpcy5nZXRDYXRlZ29yeURpc3BsYXlOYW1lKGNhdGVnb3J5KX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhdGVnb3J5LXRvZ2dsZVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+JHtlbmFibGVkQ291bnR9LyR7dG90YWxDb3VudH08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJjaGVja2JveCBjYXRlZ29yeS1jaGVja2JveFwiIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEtY2F0ZWdvcnk9XCIke2NhdGVnb3J5fVwiIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZW5hYmxlZENvdW50ID09PSB0b3RhbENvdW50ID8gJ2NoZWNrZWQnIDogJyd9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidG9vbC1saXN0XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICR7dG9vbHMubWFwKCh0b29sOiBhbnkpID0+IGBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b29sLWl0ZW1cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidG9vbC1pbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b29sLW5hbWVcIj4ke3Rvb2wubmFtZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRvb2wtZGVzY3JpcHRpb25cIj4ke3Rvb2wuZGVzY3JpcHRpb259PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRvb2wtdG9nZ2xlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cImNoZWNrYm94IHRvb2wtY2hlY2tib3hcIiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEtY2F0ZWdvcnk9XCIke3Rvb2wuY2F0ZWdvcnl9XCIgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLW5hbWU9XCIke3Rvb2wubmFtZX1cIiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7dG9vbC5lbmFibGVkID8gJ2NoZWNrZWQnIDogJyd9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGApLmpvaW4oJycpfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgYDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGNhdGVnb3J5RGl2KTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmJpbmRUb29sRXZlbnRzKCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgYmluZFRvb2xFdmVudHModGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jYXRlZ29yeS1jaGVja2JveCcpLmZvckVhY2goKGNoZWNrYm94OiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYXRlZ29yeSA9IGUudGFyZ2V0LmRhdGFzZXQuY2F0ZWdvcnk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hlY2tlZCA9IGUudGFyZ2V0LmNoZWNrZWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b2dnbGVDYXRlZ29yeVRvb2xzKGNhdGVnb3J5LCBjaGVja2VkKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy50b29sLWNoZWNrYm94JykuZm9yRWFjaCgoY2hlY2tib3g6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGU6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5ID0gZS50YXJnZXQuZGF0YXNldC5jYXRlZ29yeTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gZS50YXJnZXQuZGF0YXNldC5uYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSBlLnRhcmdldC5jaGVja2VkO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9vbFN0YXR1cyhjYXRlZ29yeSwgbmFtZSwgZW5hYmxlZCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgYXN5bmMgdG9nZ2xlQ2F0ZWdvcnlUb29scyh0aGlzOiBhbnksIGNhdGVnb3J5OiBzdHJpbmcsIGVuYWJsZWQ6IGJvb2xlYW4pIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgVG9nZ2xpbmcgY2F0ZWdvcnkgdG9vbHM6ICR7Y2F0ZWdvcnl9ID0gJHtlbmFibGVkfWApO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnlUb29scyA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24udG9vbHMuZmlsdGVyKCh0b29sOiBhbnkpID0+IHRvb2wuY2F0ZWdvcnkgPT09IGNhdGVnb3J5KTtcclxuICAgICAgICAgICAgaWYgKGNhdGVnb3J5VG9vbHMubGVuZ3RoID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVzID0gY2F0ZWdvcnlUb29scy5tYXAoKHRvb2w6IGFueSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiB0b29sLmNhdGVnb3J5LFxyXG4gICAgICAgICAgICAgICAgbmFtZTogdG9vbC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogZW5hYmxlZFxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgLy8g5YWI5pu05paw5pys5Zyw54q25oCBXHJcbiAgICAgICAgICAgICAgICBjYXRlZ29yeVRvb2xzLmZvckVhY2goKHRvb2w6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2wuZW5hYmxlZCA9IGVuYWJsZWQ7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGVkIGxvY2FsIGNhdGVnb3J5IHN0YXRlOiAke2NhdGVnb3J5fSA9ICR7ZW5hYmxlZH1gKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8g56uL5Y2z5pu05pawVUlcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNhdGVnb3J5Q291bnRzKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRvb2xDaGVja2JveGVzKGNhdGVnb3J5LCBlbmFibGVkKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDnhLblkI7lj5HpgIHliLDlkI7nq69cclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbFN0YXR1c0JhdGNoJywgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZCwgdXBkYXRlcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byB0b2dnbGUgY2F0ZWdvcnkgdG9vbHM6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ+WIh+aNouexu+WIq+W3peWFt+Wksei0pScpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyDlpoLmnpzlkI7nq6/mm7TmlrDlpLHotKXvvIzlm57mu5rmnKzlnLDnirbmgIFcclxuICAgICAgICAgICAgICAgIGNhdGVnb3J5VG9vbHMuZm9yRWFjaCgodG9vbDogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gIWVuYWJsZWQ7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUNhdGVnb3J5Q291bnRzKCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRvb2xDaGVja2JveGVzKGNhdGVnb3J5LCAhZW5hYmxlZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyB1cGRhdGVUb29sU3RhdHVzKHRoaXM6IGFueSwgY2F0ZWdvcnk6IHN0cmluZywgbmFtZTogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0aW5nIHRvb2wgc3RhdHVzOiAke2NhdGVnb3J5fS4ke25hbWV9ID0gJHtlbmFibGVkfWApO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgQ3VycmVudCBjb25maWcgSUQ6ICR7dGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZH1gKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOWFiOabtOaWsOacrOWcsOeKtuaAgVxyXG4gICAgICAgICAgICBjb25zdCB0b29sID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5maW5kKCh0OiBhbnkpID0+IFxyXG4gICAgICAgICAgICAgICAgdC5jYXRlZ29yeSA9PT0gY2F0ZWdvcnkgJiYgdC5uYW1lID09PSBuYW1lKTtcclxuICAgICAgICAgICAgaWYgKCF0b29sKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUb29sIG5vdCBmb3VuZDogJHtjYXRlZ29yeX0uJHtuYW1lfWApO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gZW5hYmxlZDtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGVkIGxvY2FsIHRvb2wgc3RhdGU6ICR7dG9vbC5uYW1lfSA9ICR7dG9vbC5lbmFibGVkfWApO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyDnq4vljbPmm7TmlrBVSe+8iOWPquabtOaWsOe7n+iuoeS/oeaBr++8jOS4jemHjeaWsOa4suafk+W3peWFt+WIl+ihqO+8iVxyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlQ2F0ZWdvcnlDb3VudHMoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDnhLblkI7lj5HpgIHliLDlkI7nq69cclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTZW5kaW5nIHRvIGJhY2tlbmQ6IGNvbmZpZ0lkPSR7dGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZH0sIGNhdGVnb3J5PSR7Y2F0ZWdvcnl9LCBuYW1lPSR7bmFtZX0sIGVuYWJsZWQ9JHtlbmFibGVkfWApO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICd1cGRhdGVUb29sU3RhdHVzJywgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZCwgY2F0ZWdvcnksIG5hbWUsIGVuYWJsZWQpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0JhY2tlbmQgcmVzcG9uc2U6JywgcmVzdWx0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSB0b29sIHN0YXR1czonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcign5pu05paw5bel5YW354q25oCB5aSx6LSlJyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIOWmguaenOWQjuerr+abtOaWsOWksei0pe+8jOWbnua7muacrOWcsOeKtuaAgVxyXG4gICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gIWVuYWJsZWQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVDYXRlZ29yeUNvdW50cygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgdXBkYXRlU3RhdHVzQmFyKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuJC50b3RhbFRvb2xzQ291bnQudGV4dENvbnRlbnQgPSAnMCc7XHJcbiAgICAgICAgICAgICAgICB0aGlzLiQuZW5hYmxlZFRvb2xzQ291bnQudGV4dENvbnRlbnQgPSAnMCc7XHJcbiAgICAgICAgICAgICAgICB0aGlzLiQuZGlzYWJsZWRUb29sc0NvdW50LnRleHRDb250ZW50ID0gJzAnO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCB0b3RhbCA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24udG9vbHMubGVuZ3RoO1xyXG4gICAgICAgICAgICBjb25zdCBlbmFibGVkID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5maWx0ZXIoKHQ6IGFueSkgPT4gdC5lbmFibGVkKS5sZW5ndGg7XHJcbiAgICAgICAgICAgIGNvbnN0IGRpc2FibGVkID0gdG90YWwgLSBlbmFibGVkO1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFN0YXR1cyBiYXIgdXBkYXRlOiB0b3RhbD0ke3RvdGFsfSwgZW5hYmxlZD0ke2VuYWJsZWR9LCBkaXNhYmxlZD0ke2Rpc2FibGVkfWApO1xyXG5cclxuICAgICAgICAgICAgdGhpcy4kLnRvdGFsVG9vbHNDb3VudC50ZXh0Q29udGVudCA9IHRvdGFsLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICAgIHRoaXMuJC5lbmFibGVkVG9vbHNDb3VudC50ZXh0Q29udGVudCA9IGVuYWJsZWQudG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgdGhpcy4kLmRpc2FibGVkVG9vbHNDb3VudC50ZXh0Q29udGVudCA9IGRpc2FibGVkLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgdXBkYXRlQ2F0ZWdvcnlDb3VudHModGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgLy8g5pu05paw5q+P5Liq57G75Yir55qE6K6h5pWw5pi+56S6XHJcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jYXRlZ29yeS1jaGVja2JveCcpLmZvckVhY2goKGNoZWNrYm94OiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5ID0gY2hlY2tib3guZGF0YXNldC5jYXRlZ29yeTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5VG9vbHMgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZpbHRlcigodDogYW55KSA9PiB0LmNhdGVnb3J5ID09PSBjYXRlZ29yeSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbmFibGVkQ291bnQgPSBjYXRlZ29yeVRvb2xzLmZpbHRlcigodDogYW55KSA9PiB0LmVuYWJsZWQpLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRvdGFsQ291bnQgPSBjYXRlZ29yeVRvb2xzLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8g5pu05paw6K6h5pWw5pi+56S6XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb3VudFNwYW4gPSBjaGVja2JveC5wYXJlbnRFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ3NwYW4nKTtcclxuICAgICAgICAgICAgICAgIGlmIChjb3VudFNwYW4pIHtcclxuICAgICAgICAgICAgICAgICAgICBjb3VudFNwYW4udGV4dENvbnRlbnQgPSBgJHtlbmFibGVkQ291bnR9LyR7dG90YWxDb3VudH1gO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyDmm7TmlrDnsbvliKvlpI3pgInmoYbnirbmgIFcclxuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNoZWNrZWQgPSBlbmFibGVkQ291bnQgPT09IHRvdGFsQ291bnQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHVwZGF0ZVRvb2xDaGVja2JveGVzKHRoaXM6IGFueSwgY2F0ZWdvcnk6IHN0cmluZywgZW5hYmxlZDogYm9vbGVhbikge1xyXG4gICAgICAgICAgICAvLyDmm7TmlrDnibnlrprnsbvliKvnmoTmiYDmnInlt6XlhbflpI3pgInmoYZcclxuICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChgLnRvb2wtY2hlY2tib3hbZGF0YS1jYXRlZ29yeT1cIiR7Y2F0ZWdvcnl9XCJdYCkuZm9yRWFjaCgoY2hlY2tib3g6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9IGVuYWJsZWQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHVwZGF0ZUJ1dHRvbnModGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGhhc0N1cnJlbnRDb25maWcgPSAhIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb247XHJcbiAgICAgICAgICAgIHRoaXMuJC5lZGl0Q29uZmlnQnRuLmRpc2FibGVkID0gIWhhc0N1cnJlbnRDb25maWc7XHJcbiAgICAgICAgICAgIHRoaXMuJC5kZWxldGVDb25maWdCdG4uZGlzYWJsZWQgPSAhaGFzQ3VycmVudENvbmZpZztcclxuICAgICAgICAgICAgdGhpcy4kLmV4cG9ydENvbmZpZ0J0bi5kaXNhYmxlZCA9ICFoYXNDdXJyZW50Q29uZmlnO1xyXG4gICAgICAgICAgICB0aGlzLiQuYXBwbHlDb25maWdCdG4uZGlzYWJsZWQgPSAhaGFzQ3VycmVudENvbmZpZztcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBjcmVhdGVDb25maWd1cmF0aW9uKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICB0aGlzLmVkaXRpbmdDb25maWcgPSBudWxsO1xyXG4gICAgICAgICAgICB0aGlzLiQubW9kYWxUaXRsZS50ZXh0Q29udGVudCA9ICfmlrDlu7rphY3nva4nO1xyXG4gICAgICAgICAgICB0aGlzLiQuY29uZmlnTmFtZS52YWx1ZSA9ICcnO1xyXG4gICAgICAgICAgICB0aGlzLiQuY29uZmlnRGVzY3JpcHRpb24udmFsdWUgPSAnJztcclxuICAgICAgICAgICAgdGhpcy5zaG93TW9kYWwoJ2NvbmZpZ01vZGFsJyk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgYXN5bmMgZWRpdENvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5lZGl0aW5nQ29uZmlnID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbjtcclxuICAgICAgICAgICAgdGhpcy4kLm1vZGFsVGl0bGUudGV4dENvbnRlbnQgPSAn57yW6L6R6YWN572uJztcclxuICAgICAgICAgICAgdGhpcy4kLmNvbmZpZ05hbWUudmFsdWUgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLm5hbWU7XHJcbiAgICAgICAgICAgIHRoaXMuJC5jb25maWdEZXNjcmlwdGlvbi52YWx1ZSA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24uZGVzY3JpcHRpb24gfHwgJyc7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvd01vZGFsKCdjb25maWdNb2RhbCcpO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGFzeW5jIHNhdmVDb25maWd1cmF0aW9uKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lID0gdGhpcy4kLmNvbmZpZ05hbWUudmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgICBjb25zdCBkZXNjcmlwdGlvbiA9IHRoaXMuJC5jb25maWdEZXNjcmlwdGlvbi52YWx1ZS50cmltKCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIW5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCfphY3nva7lkI3np7DkuI3og73kuLrnqbonKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVkaXRpbmdDb25maWcpIHtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ3VwZGF0ZVRvb2xDb25maWd1cmF0aW9uJywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZWRpdGluZ0NvbmZpZy5pZCwgeyBuYW1lLCBkZXNjcmlwdGlvbiB9KTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICdjcmVhdGVUb29sQ29uZmlndXJhdGlvbicsIG5hbWUsIGRlc2NyaXB0aW9uKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdGhpcy5oaWRlTW9kYWwoJ2NvbmZpZ01vZGFsJyk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRUb29sTWFuYWdlclN0YXRlKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2F2ZSBjb25maWd1cmF0aW9uOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCfkv53lrZjphY3nva7lpLHotKUnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGFzeW5jIGRlbGV0ZUNvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY29uZmlybWVkID0gYXdhaXQgRWRpdG9yLkRpYWxvZy53YXJuKCfnoa7orqTliKDpmaQnLCB7XHJcbiAgICAgICAgICAgICAgICBkZXRhaWw6IGDnoa7lrpropoHliKDpmaTphY3nva4gXCIke3RoaXMuY3VycmVudENvbmZpZ3VyYXRpb24ubmFtZX1cIiDlkJfvvJ/mraTmk43kvZzkuI3lj6/mkqTplIDjgIJgXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGNvbmZpcm1lZCkge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2RlbGV0ZVRvb2xDb25maWd1cmF0aW9uJywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24uaWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubG9hZFRvb2xNYW5hZ2VyU3RhdGUoKTtcclxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGRlbGV0ZSBjb25maWd1cmF0aW9uOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcign5Yig6Zmk6YWN572u5aSx6LSlJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBhcHBseUNvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0lkID0gdGhpcy4kLmNvbmZpZ1NlbGVjdG9yLnZhbHVlO1xyXG4gICAgICAgICAgICBpZiAoIWNvbmZpZ0lkKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICdzZXRDdXJyZW50VG9vbENvbmZpZ3VyYXRpb24nLCBjb25maWdJZCk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRUb29sTWFuYWdlclN0YXRlKCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gYXBwbHkgY29uZmlndXJhdGlvbjonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcign5bqU55So6YWN572u5aSx6LSlJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBleHBvcnRDb25maWd1cmF0aW9uKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2V4cG9ydFRvb2xDb25maWd1cmF0aW9uJywgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIEVkaXRvci5DbGlwYm9hcmQud3JpdGUoJ3RleHQnLCByZXN1bHQuY29uZmlnSnNvbik7XHJcbiAgICAgICAgICAgICAgICBFZGl0b3IuRGlhbG9nLmluZm8oJ+WvvOWHuuaIkOWKnycsIHsgZGV0YWlsOiAn6YWN572u5bey5aSN5Yi25Yiw5Ymq6LS05p2/JyB9KTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBleHBvcnQgY29uZmlndXJhdGlvbjonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcign5a+85Ye66YWN572u5aSx6LSlJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBpbXBvcnRDb25maWd1cmF0aW9uKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICB0aGlzLiQuaW1wb3J0Q29uZmlnSnNvbi52YWx1ZSA9ICcnO1xyXG4gICAgICAgICAgICB0aGlzLnNob3dNb2RhbCgnaW1wb3J0TW9kYWwnKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBjb25maXJtSW1wb3J0KHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICBjb25zdCBjb25maWdKc29uID0gdGhpcy4kLmltcG9ydENvbmZpZ0pzb24udmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgICBpZiAoIWNvbmZpZ0pzb24pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCfor7fovpPlhaXphY3nva5KU09OJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2ltcG9ydFRvb2xDb25maWd1cmF0aW9uJywgY29uZmlnSnNvbik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhpZGVNb2RhbCgnaW1wb3J0TW9kYWwnKTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubG9hZFRvb2xNYW5hZ2VyU3RhdGUoKTtcclxuICAgICAgICAgICAgICAgIEVkaXRvci5EaWFsb2cuaW5mbygn5a+85YWl5oiQ5YqfJywgeyBkZXRhaWw6ICfphY3nva7lt7LmiJDlip/lr7zlhaUnIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGltcG9ydCBjb25maWd1cmF0aW9uOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCflr7zlhaXphY3nva7lpLHotKUnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGFzeW5jIHNlbGVjdEFsbFRvb2xzKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTZWxlY3RpbmcgYWxsIHRvb2xzJyk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVzID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5tYXAoKHRvb2w6IGFueSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiB0b29sLmNhdGVnb3J5LFxyXG4gICAgICAgICAgICAgICAgbmFtZTogdG9vbC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZVxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgLy8g5YWI5pu05paw5pys5Zyw54q25oCBXHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZvckVhY2goKHRvb2w6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2wuZW5hYmxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdVcGRhdGVkIGxvY2FsIHN0YXRlOiBhbGwgdG9vbHMgZW5hYmxlZCcpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyDnq4vljbPmm7TmlrBVSVxyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9vbHNEaXNwbGF5KCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g54S25ZCO5Y+R6YCB5Yiw5ZCO56uvXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ3VwZGF0ZVRvb2xTdGF0dXNCYXRjaCcsIFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24uaWQsIHVwZGF0ZXMpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2VsZWN0IGFsbCB0b29sczonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcign5YWo6YCJ5bel5YW35aSx6LSlJyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIOWmguaenOWQjuerr+abtOaWsOWksei0pe+8jOWbnua7muacrOWcsOeKtuaAgVxyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5mb3JFYWNoKCh0b29sOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0b29sLmVuYWJsZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9vbHNEaXNwbGF5KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBkZXNlbGVjdEFsbFRvb2xzKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdEZXNlbGVjdGluZyBhbGwgdG9vbHMnKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZXMgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLm1hcCgodG9vbDogYW55KSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6IHRvb2wuY2F0ZWdvcnksXHJcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXHJcbiAgICAgICAgICAgICAgICBlbmFibGVkOiBmYWxzZVxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgLy8g5YWI5pu05paw5pys5Zyw54q25oCBXHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZvckVhY2goKHRvb2w6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvb2wuZW5hYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnVXBkYXRlZCBsb2NhbCBzdGF0ZTogYWxsIHRvb2xzIGRpc2FibGVkJyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIOeri+WNs+abtOaWsFVJXHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVUb29sc0Rpc3BsYXkoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDnhLblkI7lj5HpgIHliLDlkI7nq69cclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbFN0YXR1c0JhdGNoJywgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZCwgdXBkYXRlcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBkZXNlbGVjdCBhbGwgdG9vbHM6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ+WPlua2iOWFqOmAieW3peWFt+Wksei0pScpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyDlpoLmnpzlkI7nq6/mm7TmlrDlpLHotKXvvIzlm57mu5rmnKzlnLDnirbmgIFcclxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24udG9vbHMuZm9yRWFjaCgodG9vbDogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9vbHNEaXNwbGF5KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBnZXRDYXRlZ29yeURpc3BsYXlOYW1lKHRoaXM6IGFueSwgY2F0ZWdvcnk6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5TmFtZXM6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgICdzY2VuZSc6ICflnLrmma/lt6XlhbcnLFxyXG4gICAgICAgICAgICAgICAgJ25vZGUnOiAn6IqC54K55bel5YW3JyxcclxuICAgICAgICAgICAgICAgICdjb21wb25lbnQnOiAn57uE5Lu25bel5YW3JyxcclxuICAgICAgICAgICAgICAgICdwcmVmYWInOiAn6aKE5Yi25L2T5bel5YW3JyxcclxuICAgICAgICAgICAgICAgICdwcm9qZWN0JzogJ+mhueebruW3peWFtycsXHJcbiAgICAgICAgICAgICAgICAnZGVidWcnOiAn6LCD6K+V5bel5YW3JyxcclxuICAgICAgICAgICAgICAgICdwcmVmZXJlbmNlcyc6ICflgY/lpb3orr7nva7lt6XlhbcnLFxyXG4gICAgICAgICAgICAgICAgJ3NlcnZlcic6ICfmnI3liqHlmajlt6XlhbcnLFxyXG4gICAgICAgICAgICAgICAgJ2Jyb2FkY2FzdCc6ICflub/mkq3lt6XlhbcnLFxyXG4gICAgICAgICAgICAgICAgJ3NjZW5lQWR2YW5jZWQnOiAn6auY57qn5Zy65pmv5bel5YW3JyxcclxuICAgICAgICAgICAgICAgICdzY2VuZVZpZXcnOiAn5Zy65pmv6KeG5Zu+5bel5YW3JyxcclxuICAgICAgICAgICAgICAgICdyZWZlcmVuY2VJbWFnZSc6ICflj4LogIPlm77niYflt6XlhbcnLFxyXG4gICAgICAgICAgICAgICAgJ2Fzc2V0QWR2YW5jZWQnOiAn6auY57qn6LWE5rqQ5bel5YW3JyxcclxuICAgICAgICAgICAgICAgICd2YWxpZGF0aW9uJzogJ+mqjOivgeW3peWFtydcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmV0dXJuIGNhdGVnb3J5TmFtZXNbY2F0ZWdvcnldIHx8IGNhdGVnb3J5O1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHNob3dNb2RhbCh0aGlzOiBhbnksIG1vZGFsSWQ6IHN0cmluZykge1xyXG4gICAgICAgICAgICB0aGlzLiRbbW9kYWxJZF0uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgaGlkZU1vZGFsKHRoaXM6IGFueSwgbW9kYWxJZDogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJFttb2RhbElkXS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIHNob3dFcnJvcih0aGlzOiBhbnksIG1lc3NhZ2U6IHN0cmluZykge1xyXG4gICAgICAgICAgICBFZGl0b3IuRGlhbG9nLmVycm9yKCfplJnor68nLCB7IGRldGFpbDogbWVzc2FnZSB9KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBzYXZlQ2hhbmdlcyh0aGlzOiBhbnkpIHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcign5rKh5pyJ6YCJ5oup6YWN572uJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAvLyDnoa7kv53lvZPliY3phY3nva7lt7Lkv53lrZjliLDlkI7nq69cclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbENvbmZpZ3VyYXRpb24nLCBcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLmlkLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24ubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24uZGVzY3JpcHRpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xzOiB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIEVkaXRvci5EaWFsb2cuaW5mbygn5L+d5a2Y5oiQ5YqfJywgeyBkZXRhaWw6ICfphY3nva7mm7TmlLnlt7Lkv53lrZgnIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHNhdmUgY2hhbmdlczonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcign5L+d5a2Y5pu05pS55aSx6LSlJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBiaW5kRXZlbnRzKHRoaXM6IGFueSkge1xyXG4gICAgICAgICAgICB0aGlzLiQuY3JlYXRlQ29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5jcmVhdGVDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xyXG4gICAgICAgICAgICB0aGlzLiQuZWRpdENvbmZpZ0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuZWRpdENvbmZpZ3VyYXRpb24uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuJC5kZWxldGVDb25maWdCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmRlbGV0ZUNvbmZpZ3VyYXRpb24uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuJC5hcHBseUNvbmZpZ0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuYXBwbHlDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xyXG4gICAgICAgICAgICB0aGlzLiQuZXhwb3J0Q29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5leHBvcnRDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xyXG4gICAgICAgICAgICB0aGlzLiQuaW1wb3J0Q29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5pbXBvcnRDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy4kLnNlbGVjdEFsbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuc2VsZWN0QWxsVG9vbHMuYmluZCh0aGlzKSk7XHJcbiAgICAgICAgICAgIHRoaXMuJC5kZXNlbGVjdEFsbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuZGVzZWxlY3RBbGxUb29scy5iaW5kKHRoaXMpKTtcclxuICAgICAgICAgICAgdGhpcy4kLnNhdmVDaGFuZ2VzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5zYXZlQ2hhbmdlcy5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuJC5jbG9zZU1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5oaWRlTW9kYWwoJ2NvbmZpZ01vZGFsJykpO1xyXG4gICAgICAgICAgICB0aGlzLiQuY2FuY2VsQ29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5oaWRlTW9kYWwoJ2NvbmZpZ01vZGFsJykpO1xyXG4gICAgICAgICAgICB0aGlzLiQuY29uZmlnRm9ybS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCAoZTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNhdmVDb25maWd1cmF0aW9uKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy4kLmNsb3NlSW1wb3J0TW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVNb2RhbCgnaW1wb3J0TW9kYWwnKSk7XHJcbiAgICAgICAgICAgIHRoaXMuJC5jYW5jZWxJbXBvcnRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVNb2RhbCgnaW1wb3J0TW9kYWwnKSk7XHJcbiAgICAgICAgICAgIHRoaXMuJC5jb25maXJtSW1wb3J0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5jb25maXJtSW1wb3J0LmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy4kLmNvbmZpZ1NlbGVjdG9yLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuYXBwbHlDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICByZWFkeSgpIHtcclxuICAgICAgICAodGhpcyBhcyBhbnkpLnRvb2xNYW5hZ2VyU3RhdGUgPSBudWxsO1xyXG4gICAgICAgICh0aGlzIGFzIGFueSkuY3VycmVudENvbmZpZ3VyYXRpb24gPSBudWxsO1xyXG4gICAgICAgICh0aGlzIGFzIGFueSkuY29uZmlndXJhdGlvbnMgPSBbXTtcclxuICAgICAgICAodGhpcyBhcyBhbnkpLmF2YWlsYWJsZVRvb2xzID0gW107XHJcbiAgICAgICAgKHRoaXMgYXMgYW55KS5lZGl0aW5nQ29uZmlnID0gbnVsbDtcclxuXHJcbiAgICAgICAgKHRoaXMgYXMgYW55KS5iaW5kRXZlbnRzKCk7XHJcbiAgICAgICAgKHRoaXMgYXMgYW55KS5sb2FkVG9vbE1hbmFnZXJTdGF0ZSgpO1xyXG4gICAgfSxcclxuICAgIGJlZm9yZUNsb3NlKCkge1xyXG4gICAgICAgIC8vIOa4heeQhuW3peS9nFxyXG4gICAgfSxcclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIC8vIOmdouadv+WFs+mXrea4heeQhlxyXG4gICAgfVxyXG59IGFzIGFueSk7ICJdfQ==