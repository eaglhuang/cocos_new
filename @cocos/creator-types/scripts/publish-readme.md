# creator types 发布说明

## 发布步骤

## 发布到外网的公开定义

1. 生成 dts 文件
    在编辑器主仓库根目录下执行

    ```bash
    npm run build:dts -- --release
    ```

    确认输出的日志里有 `generate creator-types (public)` 字样，因为接口定义有份层级，对外版本只能包含 `public` 的接口定义。

2. 修改版本号，检查本地的定义修改，修改版本号，提交到 github master 分支，并推送到远程仓库。

【注意】

> 仓库内包含自动发布工作流，如果不发布版本，请不要将版本号修改为正式版本号，可以多次提交非正式版本号到线上供论坛版使用测试。

## 发布到内网的定义

1. 生成 dts 文件
    在编辑器主仓库根目录下执行

    ```bash
    npm run build:dts
    ```

    确认输出的日志里有 `generate creator-types (protected)` 字样，因为接口定义有份层级，对外版本只能包含 `protected` 的接口定义。
2. 修改包名为 @base/creator-types ，执行 npm publish 发布即可
