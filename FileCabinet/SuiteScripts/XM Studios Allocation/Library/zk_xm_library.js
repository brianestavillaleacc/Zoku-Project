define(['N/record', 'N/search', 'N/config','N/file','N/runtime', 'N/format','N/url'],
    function(record, search, config,file,runtime, format,url) {
        var userObj = runtime.getCurrentUser();
        var stDatePreference = userObj.getPreference({ name: "dateformat"});
        var fn = {};
        var CUSTOMER_CATEGORY_DISTRIBUTOR=1;

        fn.allocationOrderLink = function(){
            var stAllocationOrderLink="";
            if(runtime.envType == runtime.EnvType.SANDBOX) {
                stAllocationOrderLink = "https://6961610-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=260";
            } else {
                stAllocationOrderLink = "https://6961610.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=282";
            }
            return stAllocationOrderLink;
        };

        fn.getFormattedDate = function(stDate) {
            var month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            var month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            var objMonth = {
                'Jan': 1,
                'Feb': 2,
                'Mar': 3,
                'Apr': 4,
                'May': 5,
                'Jun': 6,
                'Jul': 7,
                'Aug': 8,
                'Sep': 9,
                'Oct': 10,
                'Nov': 11,
                'Dec': 12
            };

            switch (stDatePreference) {
                case 'M/D/YYYY':
                case 'MM/DD/YYYY':
                    var arrDate = stDate.split('/');
                    var strdate = new Date(arrDate[0] + '/' + arrDate[1] + '/' + arrDate[2]);
                    return strdate;
                    // return Number(strdate.getMonth()+1) + '/' + strdate.getDate() + '/' + strdate.getFullYear();
                    break;
                case 'D/M/YYYY':
                case 'DD/MM/YYYY':
                    var arrDate = stDate.split('/');
                    var strdate = new Date(arrDate[1] + '/' + arrDate[0] + '/' + arrDate[2]); //MM/DD/YYYY
                    return strdate;
                    // return strdate.getDate() + '/' +Number(strdate.getMonth()+1) + '/' + strdate.getFullYear();
                    break;
                case 'D-Mon-YYYY':
                case 'DD-Mon-YYYY':
                    var arrDate = stDate.split('-');
                    var strdate = new Date(objMonth[arrDate[1]] + '/' + arrDate[0] + '/' + arrDate[2]); //MM/DD/YYYY
                    return strdate;
                    // return strdate.getDate() + '-' +month_names_short[strdate.getMonth()] + '-' + strdate.getFullYear();
                    break;
                case 'D.M.YYYY':
                case 'DD.MM.YYYY':
                    var arrDate = stDate.split('.');
                    var strdate = new Date(arrDate[1] + '/' + arrDate[0] + '/' + arrDate[2]); //MM/DD/YYYY
                    return strdate;
                    // return strdate.getDate() + '.' +Number(strdate.getMonth()+1) + '.' + strdate.getFullYear();
                    break;
                case 'D-MONTH-YYYY':
                case 'DD-MONTH-YYYY':
                    var strdate = new Date(stDate); //MM/DD/YYYY
                    return strdate;
                    // return strdate.getDate() + '-' +month_names[strdate.getMonth()] + '-' + strdate.getFullYear();
                    break;
                case 'D MONTH, YYYY':
                case 'DD MONTH, YYYY':
                    var strdate = new Date(stDate); //MM/DD/YYYY
                    return strdate;
                    // return strdate.getDate() + ' ' +month_names[strdate.getMonth()] + ', ' + strdate.getFullYear();
                    break;
                case 'YYYY/M/D':
                case 'YYYY/MM/DD':
                    var arrDate = stDate.split('/');
                    var strdate = new Date(arrDate[1] + '/' + arrDate[2] + '/' + arrDate[0]); //MM/DD/YYYY
                    return strdate;
                    // return strdate.getFullYear() + '/' + Number(strdate.getMonth()+1) + '/' + strdate.getDate();
                    break;
                case 'YYYY-M-D':
                case 'YYYY-MM-DD':
                    var arrDate = stDate.split('-');
                    var strdate = new Date(arrDate[1] + '/' + arrDate[2] + '/' + arrDate[0]); //MM/DD/YYYY
                    return strdate;
                    // return strdate.getFullYear() + '-' + Number(strdate.getMonth()+1) + '-' + strdate.getDate();
                    break;
            }
        }

        fn.runSearch =  function(recType, searchId, filters, columns) {
            var srchObj = null;
            var arrSearchResults = [];
            var arrResultSet = null;
            var intSearchIndex = 0;

            // if search is ad-hoc (created via script)
            if (searchId == null || searchId == '') {
                srchObj = search.create({
                    type : recType,
                    filters : filters,
                    columns : columns
                });
            } else { // if there is an existing saved search called and used inside the script
                srchObj = search.load({
                    id : searchId
                });
                var existFilters = srchObj.filters;
                var existColumns = srchObj.columns;

                var arrNewFilters = [];
                var bIsResultsWithSummary = false;

                for (var i = 0; i < existFilters.length; i++) {
                    var stFilters = JSON.stringify(existFilters[i]);
                    var objFilters = JSON.parse(stFilters);

                    var objFilter = search.createFilter({
                        name : objFilters.name,
                        join : objFilters.join,
                        operator : objFilters.operator,
                        values : objFilters.values,
                        formula : objFilters.formula,
                        summary : objFilters.summary
                    });

                    arrNewFilters.push(objFilter);
                }

                existFilters = (existFilters == null || existFilters == '') ? new Array() : existFilters;
                existColumns = (existColumns == null || existColumns == '') ? new Array() : existColumns;

                // include additional filters created via script
                if (filters != null && filters != '') {
                    for (var idx = 0; idx < filters.length; idx++) {
                        existFilters.push(filters[idx]);
                    }
                }

                //  log.debug('Filter', JSON.stringify(existFilters));

                // include additional columns created via script
                if (columns != null && columns != '')
                {
                    for (var idx = 0; idx < columns.length; idx++)
                    {
                        existColumns.push(columns[idx]);
                    }
                }

                for (var i = 0; i < existColumns.length; i++)
                {
                    var stColumns = JSON.stringify(existColumns[i]);
                    var objColumns = JSON.parse(stColumns);

                    if (objColumns.summary != null)
                    {
                        bIsResultsWithSummary = true;
                        break;
                    }
                }

                if (!bIsResultsWithSummary)
                {
                    existColumns.push(search.createColumn({
                        name : 'internalid'
                    }));
                }
                else
                {
                    existColumns.push(search.createColumn({
                        name : 'internalid',
                        summary : 'GROUP'
                    }));
                }

                // reset original filters and columns to original ones + those passed via script
                srchObj.filters = existFilters;
                srchObj.columns = existColumns;
            }

            var objRS = srchObj.run();

            // do the logic below to get all the search results because if not, you will only get 4000 max results
            do {
                arrResultSet = objRS.getRange(intSearchIndex, intSearchIndex + 1000);
                if (!(arrResultSet))
                {
                    break;
                }

                arrSearchResults = arrSearchResults.concat(arrResultSet);
                intSearchIndex = arrSearchResults.length;
            } while (arrResultSet.length >= 1000);

            var objResults = {};
            objResults.resultSet = objRS;
            objResults.actualResults = arrSearchResults;
            objResults.stSearchRecType = srchObj.searchType;

            return  objResults.actualResults;
        }

        fn.getLocations = function() {
            var objData = {};
            var locationSearchObj = search.create({
                type: "location",
                filters: ["isinactive","is","F"],
                columns: [
                    search.createColumn({ name: "name", sort: search.Sort.ASC, label: "Name" })
                ]
            });
            var searchResultCount = locationSearchObj.runPaged().count;
            if(searchResultCount != 0) {
                locationSearchObj.run().each(function(result){
                    if(objData[result.id] == null) { objData[result.id] = {}; }
                    objData[result.id] = {
                        'recordid': result.id,
                        'name': result.getValue('name')
                    };
                    return true;
                });
            }
            return objData;
        }

        fn.getCustomers = function() {
            var objData = {};
            var filters = [
                ["isinactive", "is", "F"],"AND",
                ["category", "anyof", [CUSTOMER_CATEGORY_DISTRIBUTOR]]
            ];
            var columns = [ search.createColumn({ name: "entityid" }) ];
            var customerSearchObj = fn.runSearch("customer",  null, filters, columns);
            if(customerSearchObj.length != 0) {
                for(var intIndex=0; intIndex<customerSearchObj.length; intIndex++) {
                    if(objData[customerSearchObj[intIndex].id] == null) { objData[customerSearchObj[intIndex].id] = {}; }
                    objData[customerSearchObj[intIndex].id] = {
                        'recordid': customerSearchObj[intIndex].id,
                        'name': customerSearchObj[intIndex].getValue('entityid')
                    };
                }
            }
            return objData;
        }

        fn.getBrands = function() {
            var objData = {};
            var itemSearchObj = search.create({
                type: "customlist_brand_license",
                filters: ["isinactive","is","F"],
                columns: [ search.createColumn({ name: "name" }) ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            if(searchResultCount != 0) {
                itemSearchObj.run().each(function(result){
                    if(objData[result.id] == null) { objData[result.id] = {}; }
                    objData[result.id] = {
                        'recordid': result.id,
                        'name': result.getValue('name')
                    };
                    return true;
                });
            }
            return objData;
        }

        fn.getCategories = function() {
            var objData = {};
            var itemSearchObj = search.create({
                type: "customlist_brand_category",
                filters: ["isinactive","is","F"],
                columns: [ search.createColumn({ name: "name" }) ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            if(searchResultCount != 0) {
                itemSearchObj.run().each(function(result){
                    if(objData[result.id] == null) { objData[result.id] = {}; }
                    objData[result.id] = {
                        'recordid': result.id,
                        'name': result.getValue('name')
                    };
                    return true;
                });
            }
            return objData;
        }

        fn.getItems = function() {
            var objData = {};
            var filters = [
                ["isinactive", "is", "F"], "AND",
                ["type", "anyof", ["InvtPart","Kit"]]
            ];
            var columns = [
                search.createColumn({name: "itemid", sort: search.Sort.ASC}),
                search.createColumn({name: "displayname"}),
                search.createColumn({name: "type"}),
                search.createColumn({name: "baseprice"}),
                search.createColumn({name: "totalquantityonhand"}),
                search.createColumn({name: "custitem_zk_estimated_manufacture_qty"}),
                search.createColumn({name: "custitem_zk_available_manufacture_qty"}),
                search.createColumn({name: "custitem_zoku_brand_category"}),
                search.createColumn({name: "custitem_zoku_brand_license_2"}),
                search.createColumn({name: "custitem_zk_deposit_amount"}),
                search.createColumn({name: "custitem_zoku_edition_size"}),
                search.createColumn({name: "custitem_zoku_sample_qty"}),
                search.createColumn({name: "custitem_zk_distributor_pool"}),
                search.createColumn({name: "custitem_xm_wmitemtype"}),
                search.createColumn({name: "custitem_xm_productseries"})
            ];
            var itemSearchObj = fn.runSearch("item",  null, filters, columns);
            if(itemSearchObj.length != 0) {
                for(var intIndex=0; intIndex<itemSearchObj.length; intIndex++) {
                    if(objData[itemSearchObj[intIndex].id] == null) { objData[itemSearchObj[intIndex].id] = {}; }
                    objData[itemSearchObj[intIndex].id] = {
                        'recordid': itemSearchObj[intIndex].id,
                        'name': itemSearchObj[intIndex].getValue('itemid').trim(),
                        'type': itemSearchObj[intIndex].getValue('type'),
                        'displayname': itemSearchObj[intIndex].getValue('displayname'),
                        'totalquantityonhand': itemSearchObj[intIndex].getValue('totalquantityonhand'),
                        'baseprice': itemSearchObj[intIndex].getValue('baseprice') || 0,
                        'estimatedquantity': itemSearchObj[intIndex].getValue('custitem_zk_estimated_manufacture_qty') || 0,
                        'depositamount': itemSearchObj[intIndex].getValue('custitem_zk_deposit_amount') || 0,
                        'availablemanufacturequantity': itemSearchObj[intIndex].getValue('custitem_zk_available_manufacture_qty') || 0,
                        'categoryid': itemSearchObj[intIndex].getValue('custitem_zoku_brand_category'),
                        'brandid': itemSearchObj[intIndex].getValue('custitem_zoku_brand_license_2'),
                        'categoryname': itemSearchObj[intIndex].getText('custitem_zoku_brand_category'),
                        'brandname': itemSearchObj[intIndex].getText('custitem_zoku_brand_license_2'),
                        'es': itemSearchObj[intIndex].getValue('custitem_zoku_edition_size'),
                        'sample': itemSearchObj[intIndex].getValue('custitem_zoku_sample_qty'),
                        'distributorpool': itemSearchObj[intIndex].getValue({name:"custitem_zk_distributor_pool"}) || 0,
                        'itemtype': itemSearchObj[intIndex].getText({name:"custitem_xm_wmitemtype"}),
                        'productseries': itemSearchObj[intIndex].getText({name:"custitem_xm_productseries"})
                    };
                }
            }

            return objData;
        }

        fn.getItemInventoryDetails = function(intItemId, intBrand, intCategory) {
            var objData = {};
            if(!intItemId) { return objData; };
            var filters = [
                ["isinactive","is","F"], "AND",
                ["internalid","is",intItemId]
            ];

            // if(intBrand) {
            //     filters.push("AND");
            //     filters.push(["custitem_zoku_brand_license_2","is",intBrand]  );
            // }
            // if(intCategory) {
            //     filters.push("AND");
            //     filters.push(["custitem_zoku_brand_category","is",intCategory]  );
            // }

            var itemSearchObj = search.create({
                type: "item",
                filters: filters,
                columns: [
                    search.createColumn({ name: "itemid", sort: search.Sort.ASC, label: "Name" }),
                    search.createColumn({name: "displayname", label: "Display Name"}),
                    search.createColumn({name: "locationquantityavailable", label: "Location Available"}),
                    search.createColumn({name: "locationquantitybackordered", label: "Location Back Ordered"}),
                    search.createColumn({name: "locationquantitycommitted", label: "Location Committed"}),
                    search.createColumn({name: "locationquantityonhand", label: "Location On Hand"}),
                    search.createColumn({name: "inventorylocation", label: "Inventory Location"}),
                    search.createColumn({name: "locationquantityonorder", label: "Location On Order"}),
                    search.createColumn({name: "custitem_zoku_edition_size"}),
                    search.createColumn({name: "custitem_zoku_sample_qty"}),
                    search.createColumn({name: "custitem_zk_distributor_pool", label: "Distributor Pool"})
                ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            if(searchResultCount!=0) {
                itemSearchObj.run().each(function(result){
                    if(objData[result.getValue({name:"inventorylocation"})] == null) { objData[result.getValue({name:"inventorylocation"})] = {}; }
                    objData[result.getValue({name:"inventorylocation"})] = {
                        itemid: result.getValue({name:"itemid"}),
                        displayname: result.getValue({name:"displayname"}),
                        locationquantityavailable: result.getValue({name:"locationquantityavailable"}) || 0,
                        locationquantitybackordered: result.getValue({name:"locationquantitybackordered"}) || 0,
                        locationquantitycommitted: result.getValue({name:"locationquantitycommitted"}) || 0,
                        locationquantityonhand: result.getValue({name:"locationquantityonhand"}) || 0,
                        inventorylocation: result.getText({name:"inventorylocation"}),
                        inventorylocationid: result.getValue({name:"inventorylocation"}),
                        locationquantityonorder: result.getValue({name:"locationquantityonorder"}) || 0,
                        es: result.getValue('custitem_zoku_edition_size') || 0,
                        sample: result.getValue('custitem_zoku_sample_qty') || 0,
                        custitem_zk_distributor_pool: result.getValue({name:"custitem_zk_distributor_pool"})
                    };
                    return true;
                });
            }
            return objData;
        }

        fn.getProductAllocations = function(intItemId, intBrand, intCategory) {
            var objData = {};
            if(intItemId == "") { return objData; }

            var filters = [
                ["custrecord_zk_pa_item","is",intItemId], "AND",
                ["custrecord_zk_pa_status","noneof","3"]
            ];

            // if(intBrand) {
            //     filters.push("AND");
            //     filters.push(["custrecord_zk_pa_item.custitem_zoku_brand_license_2","is",intBrand]  );
            // }
            //
            // if(intCategory) {
            //     filters.push("AND");
            //     filters.push(["custrecord_zk_pa_item.custitem_zoku_brand_category","is",intCategory]  );
            // }

            var itemSearchObj = search.create({
                type: "customrecord_zk_product_allocation",
                filters: filters,
                columns: [
                    search.createColumn({ name: "custrecord_zk_pa_distributor" }),
                    search.createColumn({ name: "custrecord_zk_pa_allocated_quantity" }),
                    search.createColumn({ name: "custrecord_zk_pa_ordered_quantity" }),
                    search.createColumn({ name: "custrecord_zk_pa_leftovers" }),
                    search.createColumn({ name: "custrecord_zk_pa_waitlist" }),
                    search.createColumn({ name: "custrecord_zk_pa_change" }),
                    search.createColumn({ name: "custrecord_zk_pa_status" }),
                    search.createColumn({ name: "custrecord_zk_pa_deposit" }),
                    search.createColumn({ name: "custrecord_zk_pa_balance" }),
                    search.createColumn({ name: "custrecord_zk_pa_notes" }),
                    search.createColumn({ name: "custrecord_zk_pa_item" }),
                    search.createColumn({ name: "lastmodified" }),
                    search.createColumn({ name: "custrecord_zk_pa_location" }),
                    search.createColumn({
                        name: "custentity_xm_custinternaldistributor",
                        join: "custrecord_zk_pa_distributor"
                    })
                ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            if(searchResultCount != 0) {
                itemSearchObj.run().each(function(result){
                    if(objData[result.id] == null) { objData[result.id] = {}; }
                    var viewURL = url.resolveRecord({ recordType: 'customrecord_zk_product_allocation', recordId: result.id, isEditMode: false, params: {triggeredFromDashboard: "T"} });
                    var editURL = url.resolveRecord({ recordType: 'customrecord_zk_product_allocation', recordId: result.id, isEditMode: true }) + "&scrollid="+result.id;
                    objData[result.id] = {
                        'recordid': result.id,
                        'viewAllocationOrderLink': viewURL,
                        'editAllocationOrderLink': editURL,
                        'lastmodified': result.getValue('lastmodified'),
                        'custrecord_zk_pa_distributor': result.getText('custrecord_zk_pa_distributor'),
                        'custrecord_zk_pa_allocated_quantity': result.getValue('custrecord_zk_pa_allocated_quantity') || 0,
                        'custrecord_zk_pa_ordered_quantity':  result.getValue('custrecord_zk_pa_ordered_quantity') || 0,
                        'custrecord_zk_pa_leftovers': result.getValue('custrecord_zk_pa_leftovers') || 0,
                        'custrecord_zk_pa_waitlist': result.getValue('custrecord_zk_pa_waitlist') || 0,
                        'custrecord_zk_pa_change': result.getValue('custrecord_zk_pa_change') || 0,
                        'custrecord_zk_pa_status': result.getText('custrecord_zk_pa_status'),
                        'isPending': (result.getText('custrecord_zk_pa_status') == 'Pending') ? true : false,
                        'isCancelled': (result.getText('custrecord_zk_pa_status') == 'Cancelled') ? true : false,
                        'custrecord_zk_pa_deposit': result.getValue('custrecord_zk_pa_deposit'),
                        'custrecord_zk_pa_balance': result.getValue('custrecord_zk_pa_balance'),
                        'custrecord_zk_pa_notes': result.getValue('custrecord_zk_pa_notes'),
                        'custrecord_zk_pa_item': result.getText('custrecord_zk_pa_item'),
                        'custrecord_zk_pa_location': result.getText('custrecord_zk_pa_location'),
                        'custrecord_zk_pa_locationid': result.getValue('custrecord_zk_pa_location'),
                        'isInternalDistributor': result.getValue({
                            name: "custentity_xm_custinternaldistributor",
                            join: "custrecord_zk_pa_distributor"
                        })
                    };
                    return true;
                });
            }
            return objData;
        }

        fn.getPendingProductAllocations = function(intItemId) {
            var arrData = [];

            if(!intItemId) { return arrData; };

            var customrecord_zk_product_allocationSearchObj = search.create({
                type: "customrecord_zk_product_allocation",
                filters: [
                    ["custrecord_zk_pa_status","anyof","2"], "AND",  //Pending
                    ["custrecord_zk_pa_item","anyof",[intItemId]]
                ],
                columns: [
                    search.createColumn({name: "custrecord_zk_pa_distributor", label: "Distributor"}),
                    search.createColumn({name: "custrecord_zk_pa_allocated_quantity", label: "Allocated Quantity"}),
                    search.createColumn({name: "custrecord_zk_pa_ordered_quantity", label: "Ordered Quantity"}),
                    search.createColumn({name: "custrecord_zk_pa_leftovers", label: "Leftovers"}),
                    search.createColumn({name: "custrecord_zk_pa_waitlist", label: "Waitlist"}),
                    search.createColumn({name: "custrecord_zk_pa_change", label: "Change"}),
                    search.createColumn({name: "custrecord_zk_pa_status", label: "Status"}),
                    search.createColumn({name: "custrecord_zk_pa_deposit", label: "Deposit"}),
                    search.createColumn({name: "custrecord_zk_pa_balance", label: "Balance"}),
                    search.createColumn({name: "custrecord_zk_pa_notes", label: "Notes"}),
                    search.createColumn({name: "custrecord_zk_pa_item", label: "Item"}),
                    search.createColumn({name: "custrecord_zk_pa_retail_price", label: "Retail Price"}),
                    search.createColumn({name: "custrecord_zk_pa_es", label: "ES"}),
                    search.createColumn({name: "custrecord_zk_pa_preorder_date", label: "Preorder Date"}),
                    search.createColumn({name: "custrecord_zk_pa_firstorder_deadline", label: "First Order Deadline"}),
                    search.createColumn({name: "custrecord_zk_pa_salesorder", label: "Sales Order"}),
                    search.createColumn({name: "custrecord_zk_pa_location", label: "Location"})
                ]
            });
            var searchResultCount = customrecord_zk_product_allocationSearchObj.runPaged().count;
            if(searchResultCount != 0) {
                customrecord_zk_product_allocationSearchObj.run().each(function(result){
                    var objTemp = {};
                    for(var intIndex in fn.PRODUCT_ALLOCATION_RECORD) {
                        objTemp[intIndex] = result.getValue({name:fn.PRODUCT_ALLOCATION_RECORD[intIndex]});
                    }
                    arrData.push(objTemp);
                    return true;
                });
            }
            return arrData;
        }

        fn.getCustomerDiscountPercent = function(intCustomerCategory, intPricingGroup) {
            var discountPercent = 0;
            var discountSearchObj = search.create({
                type: fn.CUSTOMER_DISCOUNTING.RECORD_TYPE,
                filters: [
                    ["isinactive","is","F"],"AND",
                    [fn.CUSTOMER_DISCOUNTING.CUSTOMER_CATEGORY,"is",intCustomerCategory],"AND",
                    [fn.CUSTOMER_DISCOUNTING.PRICING_GROUP,"is",intPricingGroup]
                ],
                columns: [ search.createColumn({name: fn.CUSTOMER_DISCOUNTING.DISCOUNT_PERCENT}) ]
            });
            var searchResultCount = discountSearchObj.runPaged().count;
            if(searchResultCount != 0) {
                discountSearchObj.run().each(function(result){
                    discountPercent = result.getValue({name: fn.CUSTOMER_DISCOUNTING.DISCOUNT_PERCENT})
                    return true;
                });
            }
            return discountPercent;
        }

        fn.getItemPrice = function(intItemId, intCurrency, intPriceLevel) {
            var flLineItemRate = 0;
            var arrData = [];
            var searchPricingObj = search.create({
                type: 'pricing',
                filters: [
                    ['item', search.Operator.IS, intItemId], 'and',
                    ['currency', search.Operator.IS, intCurrency], 'and',
                    ['pricelevel', search.Operator.IS, intPriceLevel]
                ],
                columns: [
                    search.createColumn({ name: "unitprice" }),
                    search.createColumn({ name: "quantityrange", sort: search.Sort.ASC }),
                ]
            });

            var currentRange = searchPricingObj.run().getRange({ start: 0, end: 5 });

            for (var i = 0; i < currentRange.length; i++) {
                var obj = {};
                obj['rate'] = currentRange[i].getValue('unitprice');
                obj['qtyRange'] = currentRange[i].getValue('quantityrange');
                arrData.push(obj);
            }

            for (var intIndex in arrData) {
                var arrQtyRange = arrData[intIndex].qtyRange.split("-");
                var intLimit = arrQtyRange[1];
                if (getAllocatedQuantityValue <= intLimit) {
                    flLineItemRate = arrData[intIndex].rate;
                    break;
                }
            }
            return flLineItemRate;
        }

        // fn.runSearch =  function(recType, searchId, filters, columns) {
        //     var srchObj = null;
        //     var arrSearchResults = [];
        //     var arrResultSet = null;
        //     var intSearchIndex = 0;
        //
        //     // if search is ad-hoc (created via script)
        //     if (searchId == null || searchId == '') {
        //         srchObj = search.create({
        //             type : recType,
        //             filters : filters,
        //             columns : columns
        //         });
        //     } else { // if there is an existing saved search called and used inside the script
        //         srchObj = search.load({
        //             id : searchId
        //         });
        //         var existFilters = srchObj.filters;
        //         var existColumns = srchObj.columns;
        //
        //         var arrNewFilters = [];
        //         var bIsResultsWithSummary = false;
        //
        //         for (var i = 0; i < existFilters.length; i++) {
        //             var stFilters = JSON.stringify(existFilters[i]);
        //             var objFilters = JSON.parse(stFilters);
        //
        //             var objFilter = search.createFilter({
        //                 name : objFilters.name,
        //                 join : objFilters.join,
        //                 operator : objFilters.operator,
        //                 values : objFilters.values,
        //                 formula : objFilters.formula,
        //                 summary : objFilters.summary
        //             });
        //
        //             arrNewFilters.push(objFilter);
        //         }
        //
        //         existFilters = (existFilters == null || existFilters == '') ? new Array() : existFilters;
        //         existColumns = (existColumns == null || existColumns == '') ? new Array() : existColumns;
        //
        //         // include additional filters created via script
        //         if (filters != null && filters != '') {
        //             for (var idx = 0; idx < filters.length; idx++) {
        //                 existFilters.push(filters[idx]);
        //             }
        //         }
        //
        //         //  log.debug('Filter', JSON.stringify(existFilters));
        //
        //         // include additional columns created via script
        //         if (columns != null && columns != '')
        //         {
        //             for (var idx = 0; idx < columns.length; idx++)
        //             {
        //                 existColumns.push(columns[idx]);
        //             }
        //         }
        //
        //         for (var i = 0; i < existColumns.length; i++)
        //         {
        //             var stColumns = JSON.stringify(existColumns[i]);
        //             var objColumns = JSON.parse(stColumns);
        //
        //             if (objColumns.summary != null)
        //             {
        //                 bIsResultsWithSummary = true;
        //                 break;
        //             }
        //         }
        //
        //         if (!bIsResultsWithSummary)
        //         {
        //             existColumns.push(search.createColumn({
        //                 name : 'internalid'
        //             }));
        //         }
        //         else
        //         {
        //             existColumns.push(search.createColumn({
        //                 name : 'internalid',
        //                 summary : 'GROUP'
        //             }));
        //         }
        //
        //         // reset original filters and columns to original ones + those passed via script
        //         srchObj.filters = existFilters;
        //         srchObj.columns = existColumns;
        //     }
        //
        //     var objRS = srchObj.run();
        //
        //     // do the logic below to get all the search results because if not, you will only get 4000 max results
        //     do {
        //         arrResultSet = objRS.getRange(intSearchIndex, intSearchIndex + 1000);
        //         if (!(arrResultSet))
        //         {
        //             break;
        //         }
        //
        //         arrSearchResults = arrSearchResults.concat(arrResultSet);
        //         intSearchIndex = arrSearchResults.length;
        //     } while (arrResultSet.length >= 1000);
        //
        //     var objResults = {};
        //     objResults.resultSet = objRS;
        //     objResults.actualResults = arrSearchResults;
        //     objResults.stSearchRecType = srchObj.searchType;
        //
        //     return  objResults.actualResults;
        // }

        fn.allocationStatus = {
            ACKNOWLEDGE:"1",
            PENDING:"2",
            CANCELLED:"3"
        }

        fn.PRODUCT_ALLOCATION_RECORD = {
            DISTRIBUTOR: "custrecord_zk_pa_distributor",
            ALLOCATED_QTY: "custrecord_zk_pa_allocated_quantity",
            ORDERED_QTY: "custrecord_zk_pa_ordered_quantity",
            LEFTOVERS: "custrecord_zk_pa_leftovers",
            WAITLIST: "custrecord_zk_pa_waitlist",
            CHANGE: "custrecord_zk_pa_change",
            STATUS: "custrecord_zk_pa_status",
            DEPOSIT: "custrecord_zk_pa_deposit",
            BALANCE: "custrecord_zk_pa_balance",
            NOTES: "custrecord_zk_pa_notes",
            ITEM: "custrecord_zk_pa_item",
            RETAIL_PRICE: "custrecord_zk_pa_retail_price",
            ES: "custrecord_zk_pa_es",
            PREORDER_DATE: "custrecord_zk_pa_preorder_date",
            FIRSTORDER_DEADLINE: "custrecord_zk_pa_firstorder_deadline",
            INVENTORY_STATUS_CHANGE: "custrecord_zk_pa_inventorystatuschange",
            SALES_ORDER: "custrecord_zk_pa_salesorder",
            LOCATION: "custrecord_zk_pa_location",
            PROCESS_INVENTORY_STATUS_CHANGE: "custrecord_zk_pa_process_isc",
            TO_PROCESS_CANCELLATION: "custrecord_zk_pa_process_pa_cancellation"
        };

        fn.CUSTOMER_DISCOUNTING = {
            RECORD_TYPE: "customrecord_customer_discounting",
            CUSTOMER_CATEGORY:  "custrecord_zk_cd_customer_category",
            PRICING_GROUP:  "custrecord_zk_cd_pricing_grioup",
            DISCOUNT_PERCENT:  "custrecord_zk_cd_discount_percent"
        };

        fn.ITEM_COLUMNS = [
            'item',
            'quantity',
            'rate',
            'amount',
            'itemtype',
            'custcol_zoku_product_allocation',
            'description',
            'custcol_pos3_salesrep',
            'custcol_pos3_discpromo',
            'custcol_pos3_item',
            'custcol_pos3_nettotal'
        ]

        return fn;

    });
