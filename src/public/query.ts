import {
    objectAny,
    Router,
    routesMapRule,
    RoutesRule,
    totalNextRoute
} from '../options/base';
import {
    getDataType,
    urlToJson,
    routesForMapRoute,
    getRoutePath,
    assertDeepObject,
    copyData
} from '../helpers/utils'
import {ERRORHOOK} from './hooks'
import {warn} from '../helpers/warn'

export function queryPageToMap(
    toRule:string|totalNextRoute,
    router:Router
) :{
    rule:string|totalNextRoute;
    route:RoutesRule,
    query:{[propName:string]:any}
} {
    let query:{[propName:string]:any} = {};
    let route:RoutesRule|string = '';
    let successCb = (toRule as totalNextRoute).success;
    let failCb = (toRule as totalNextRoute).fail;
    if (getDataType<string|totalNextRoute>(toRule) === '[object Object]') {
        const objNavRule = (toRule as totalNextRoute);
        if (objNavRule.path != null) {
            const {path, query: newQuery} = urlToJson(objNavRule.path);
            route = routesForMapRoute(router, path, ['finallyPathList', 'pathMap']);
            query = {...newQuery, ...((toRule as totalNextRoute).query || {})};
            delete (toRule as totalNextRoute).params;
        } else if (objNavRule.name != null) {
            route = (router.routesMap as routesMapRule).nameMap[objNavRule.name];
            if (route == null) {
                ERRORHOOK[0]({ type: 2, msg: `命名路由为：${objNavRule.name} 的路由，无法在路由表中找到！`, toRule}, router)
            } else {
                query = (toRule as totalNextRoute).params || {};
                delete (toRule as totalNextRoute).query;
            }
        } else {
            ERRORHOOK[0]({ type: 2, msg: `${toRule} 解析失败，请检测当前路由表下是否有包含。`, toRule}, router)
        }
    } else {
        toRule = urlToJson((toRule as string)) as totalNextRoute;
        route = routesForMapRoute(router, toRule.path, ['finallyPathList', 'pathMap'])
        query = toRule.query as objectAny;
    }
    if (router.options.platform === 'h5') {
        const {finallyPath} = getRoutePath(route as RoutesRule);
        if (finallyPath.includes(':') && (toRule as totalNextRoute).name == null) {
            ERRORHOOK[0]({ type: 2, msg: `当有设置 alias或者aliasPath 为动态路由时，不允许使用 path 跳转。请使用 name 跳转！`, route}, router)
        }
        const completeCb = (toRule as totalNextRoute).complete;
        const cacheSuccess = (toRule as totalNextRoute).success;
        const cacheFail = (toRule as totalNextRoute).fail;
        if (getDataType<Function|undefined>(completeCb) === '[object Function]') {
            const publicCb = function(this:any, args:Array<any>, callHook:Function|undefined):void {
                if (getDataType<Function|undefined>(callHook) === '[object Function]') {
                    (callHook as Function).apply(this, args);
                }
                (completeCb as Function).apply(this, args);
            }
            successCb = function(this:any, ...args:any):void{
                publicCb.call(this, args, cacheSuccess);
            };
            failCb = function(this:any, ...args:any):void{
                publicCb.call(this, args, cacheFail);
            };
        }
    } else {
        console.log('这是非h端 需要做的 TODO')
    }
    const rule = (toRule as totalNextRoute);
    if (getDataType<Function|undefined>(rule.success) === '[object Function]') {
        rule.success = successCb;
    }
    if (getDataType<Function|undefined>(rule.fail) === '[object Function]') {
        rule.fail = failCb;
    }
    return {
        rule,
        route: (route as RoutesRule),
        query
    }
}

export function resolveQuery(
    toRule:totalNextRoute,
    router:Router
):totalNextRoute {
    let queryKey:'params'|'query' = 'query';
    if (toRule.params as objectAny != null) {
        queryKey = 'params';
    }
    if (toRule.query as objectAny != null) {
        queryKey = 'query';
    }
    const query = copyData(toRule[queryKey] || {});
    const {resolveQuery: userResolveQuery} = router.options;
    if (userResolveQuery) {
        const jsonQuery = userResolveQuery(query);
        if (getDataType<objectAny>(jsonQuery) !== '[object Object]') {
            warn('请按格式返回参数： resolveQuery?:(jsonQuery:{[propName: string]: any;})=>{[propName: string]: any;}', router)
        } else {
            toRule[queryKey] = jsonQuery;
        }
    } else {
        const deepObj = assertDeepObject(query as objectAny);
        if (!deepObj) {
            return toRule;
        }
        const encode = encodeURIComponent(JSON.stringify(query));
        toRule[queryKey] = {
            query: encode
        }
    }
    return toRule
}

export function parseQuery(
    query:objectAny,
    router:Router
):objectAny {
    const {parseQuery: userParseQuery} = router.options;
    if (userParseQuery) {
        query = userParseQuery(copyData(query));
        if (getDataType<objectAny>(query) !== '[object Object]') {
            warn('请按格式返回参数： parseQuery?:(jsonQuery:{[propName: string]: any;})=>{[propName: string]: any;}', router)
        }
    } else {
        if (Reflect.get(query, 'query')) { // 验证一下是不是深度对象
            const deepQuery = Reflect.get(query, 'query');
            let jsonQuery:objectAny = {
                query: decodeURIComponent(deepQuery)
            };
            try {
                jsonQuery = JSON.parse(jsonQuery.query);
                if (typeof jsonQuery === 'object') {
                    return jsonQuery;
                }
            } catch (error) {
                warn('尝试解析深度对象失败，按原样输出。' + error, router)
            }
        }
    }
    return query
}