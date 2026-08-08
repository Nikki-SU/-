# 刷题App测试题库（18题）

## 第1题
**题目：** React Native中，View组件的主要作用是什么？

A. 显示文本
B. 作为容器组件，布局和样式
C. 处理用户输入
D. 导航页面

**答案：** B
**解析：** View组件是React Native中最基本的布局组件，用于构建UI结构，支持样式和布局。

## 第2题
**题目：** React Native中，以下哪些是内置组件？（多选）

A. View
B. Text
C. Image
D. ScrollView

**答案：** ABCD
**解析：** 以上都是React Native的内置核心组件。

## 第3题
**题目：** React Native中，StyleSheet.create的主要作用是什么？

A. 创建全局样式变量
B. 优化性能，在JS和Native之间共享样式引用
C. 动态创建样式
D. 定义主题

**答案：** B
**解析：** StyleSheet.create用于创建不可变的样式表，可在JS和Native之间共享引用以优化性能。

## 第4题
**题目：** React Native中，以下哪些是有效的Flexbox属性？（多选）

A. flexDirection
B. justifyContent
C. alignItems
D. flexWrap

**答案：** ABCD
**解析：** 以上都是React Native中有效的Flexbox布局属性。

## 第5题
**题目：** React Native中，TouchableOpacity和TouchableHighlight的主要区别是什么？

A. TouchableOpacity不透明度变化，TouchableHighlight高亮显示
B. TouchableOpacity高亮显示，TouchableHighlight不透明度变化
C. 两者没有区别
D. TouchableOpacity只能用于Android

**答案：** A
**解析：** TouchableOpacity点击时组件不透明度降低；TouchableHighlight点击时背景高亮。

## 第6题
**题目：** React Native中，哪个Hook用于副作用？

A. useState
B. useRef
C. useEffect
D. useMemo

**答案：** C
**解析：** useEffect用于执行副作用，如数据获取、订阅等。

## 第7题
**题目：** React Native中，以下哪些是导航库？（多选）

A. React Navigation
B. React Native Navigation
C. React Router
D. Vue Router

**答案：** ABC
**解析：** React Router也可以在React Native Web中使用；Vue Router是Vue.js的。

## 第8题
**题目：** React Native中，FlatList和ScrollView的主要区别是什么？

A. FlatList支持虚拟化，性能更好
B. ScrollView支持虚拟化，性能更好
C. 两者没有区别
D. FlatList只能显示固定数量的项目

**答案：** A
**解析：** FlatList支持虚拟化，性能更好，适合长列表。

## 第9题
**题目：** React Native中，AsyncStorage的主要作用是什么？

A. 存储结构化数据
B. 异步存储键值对数据
C. 存储媒体文件
D. 网络请求

**答案：** B
**解析：** AsyncStorage用于异步存储键值对数据，是React Native的持久化存储方案。

## 第10题
**题目：** React Native中，以下哪些是用于状态管理的库？（多选）

A. Redux
B. MobX
C. Zustand
D. D3

**答案：** ABC
**解析：** Redux、MobX、Zustand都是React Native中常用的状态管理库；D3是数据可视化库。

## 第11题
**题目：** React Native中，如何处理不同平台的代码差异？

A. 使用Platform组件
B. 使用if/else判断
C. 使用条件导入
D. 以上都可以

**答案：** D
**解析：** React Native提供了Platform模块和特定平台文件（.ios.js、.android.js）来处理平台差异。

## 第12题
**题目：** React Native中，以下哪些是动画API？（多选）

A. Animated
B. LayoutAnimation
C. PanResponder
D. useRef

**答案：** ABC
**解析：** Animated、LayoutAnimation、PanResponder都是React Native的动画相关API；useRef是Hook。

## 第13题
**题目：** React Native中，AppRegistry的主要作用是什么？

A. 注册应用入口
B. 管理应用状态
C. 处理路由
D. 网络请求

**答案：** A
**解析：** AppRegistry用于注册应用的入口组件，告知React Native哪个组件是应用的根组件。

## 第14题
**题目：** React Native中，以下哪些是有效的图片组件属性？（多选）

A. source
B. style
C. resizeMode
D. onPress

**答案：** ABCD
**解析：** Image组件支持source、style、resizeMode等属性；如果需要onPress，通常需要用Touchable组件包裹。

## 第15题
**题目：** React Native中，Text组件的numberOfLines属性用于什么？

A. 设置字体大小
B. 限制显示的行数
C. 设置字体颜色
D. 设置字间距

**答案：** B
**解析：** numberOfLines属性用于限制Text组件显示的最大行数，超出部分会被截断。

## 第16题
**题目：** React Native中，以下哪些是性能优化方法？（多选）

A. 使用FlatList替代ScrollView
B. 使用React.memo
C. 避免不必要的渲染
D. 使用JSON.parse代替eval

**答案：** ABCD
**解析：** 以上都是React Native中常用的性能优化方法。

## 第17题
**题目：** React Native中，如何创建一个自定义组件？

A. 使用函数组件
B. 使用类组件
C. 使用AppRegistry
D. 以上都可以

**答案：** D
**解析：** React Native支持函数组件和类组件两种方式创建自定义组件。

## 第18题
**题目：** 以下哪个不是有效的HTTP方法？

A. GET
B. POST
C. FETCH
D. DELETE

**答案：** C
**解析：** FETCH不是HTTP方法，它是JavaScript的API。标准HTTP方法包括GET、POST、PUT、DELETE、PATCH等。
